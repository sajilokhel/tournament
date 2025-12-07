/**
 * eSewa Payment Verification API
 *
 * Purpose:
 *   Verify a payment transaction with the eSewa gateway and reconcile the result
 *   with the local booking system. When eSewa confirms a payment, this endpoint
 *   attempts to mark the corresponding booking as `confirmed`, log the payment,
 *   and convert any held slot into a confirmed booking.
 *
 * Endpoint:
 *   POST /api/payment/verify
 *
 * Authentication:
 *   - This endpoint does not accept a user Bearer token in the current code;
 *     it calls out to eSewa and performs DB updates using the Admin SDK.
 *   - Authorization/validation of callers (if required) should be enforced by
 *     infrastructure (e.g. use a webhook secret, server-only route, or verify
 *     eSewa origin). The current implementation trusts the request payload.
 *
 * Expected Request (JSON body):
 *   {
 *     "transactionUuid": string,    // transaction identifier generated at payment initiation,
 *                                   // commonly <bookingId>_<timestamp>
 *     "productCode": string,        // merchant code / product identifier used in initiation
 *     "totalAmount": number|string  // amount used when creating the payment (e.g. 200)
 *   }
 *
 * Typical Flow / Side-effects:
 *   1. Generates a verification signature and issues a verification request to eSewa.
 *   2. Parses eSewa response (status, ref_id, total_amount, transaction_uuid).
 *   3. If the response indicates completion (status === 'COMPLETE'):
 *        - Locates the booking using strategies:
 *            a) doc id equals transactionUuid
 *            b) doc id equals prefix before last '_' in transactionUuid
 *            c) query booking where esewaTransactionUuid == transactionUuid
 *        - If booking found and is not already confirmed:
 *            - Calls `bookSlot` to convert the hold into a confirmed slot.
 *            - Updates booking document:
 *                status: 'confirmed'
 *                paymentTimestamp: server timestamp
 *                esewaTransactionCode / esewaTransactionUuid / esewaStatus / esewaAmount
 *                verifiedAt: server timestamp
 *            - Logs payment via `logPayment`
 *        - If booking not found, still logs the payment for manual reconciliation.
 *   4. If the response is not COMPLETE (PENDING/FAILED/etc), the endpoint:
 *        - Avoids deleting or removing booking/held records for non-terminal statuses.
 *        - For terminal failure statuses (e.g. 'FAILED', 'CANCELED') it may mark
 *          the booking as failed/verificationFailedAt.
 *
 * Responses:
 *
 * - Payment verified & booking confirmed (happy path)
 *   Status: 200
 *   Body:
 *     {
 *       verified: true,
 *       status: 'COMPLETE',
 *       transactionUuid: string,
 *       refId: string,
 *       totalAmount: number|string,
 *       productCode: string,
 *       bookingConfirmed: true,
 *       bookingData: { bookingId, venueId, userId, date, startTime, endTime, amount, bookingType }
 *     }
 *
 * - Payment verified but booking update failed (DB error)
 *   Status: 200
 *   Body:
 *     {
 *       verified: true,
 *       status: 'COMPLETE',
 *       bookingConfirmed: false,
 *       bookingUpdateFailed: true,
 *       message: 'Payment verified but failed to update booking; payment logged for manual reconciliation'
 *     }
 *
 * - Payment verified but booking not found
 *   Status: 200
 *   Body:
 *     {
 *       verified: true,
 *       status: 'COMPLETE',
 *       bookingFound: false,
 *       message: 'Payment verified but booking document not found; payment logged for manual reconciliation'
 *     }
 *
 * - Payment not complete / pending
 *   Status: 200
 *   Body:
 *     {
 *       verified: false,
 *       status: '<NON-COMPLETE-STATUS>',
 *       transactionUuid: string,
 *       refId: string,
 *       totalAmount: number|string,
 *       productCode: string,
 *       bookingFound: boolean,
 *       bookingId: string|null,
 *       message: 'Payment not completed; booking retained (no automatic deletion).'
 *     }
 *
 * - Bad request (missing parameters)
 *   Status: 400
 *   Body:
 *     { error: 'Missing required parameters: transactionUuid, productCode' }
 *
 * - External verification failure (eSewa returned error / non-OK HTTP)
 *   Status: 400
 *   Body:
 *     {
 *       error: 'Payment verification failed',
 *       details: '<raw eSewa response>',
 *       verified: false,
 *       status: 'FAILED'
 *     }
 *
 * - Internal server error
 *   Status: 500
 *   Body:
 *     { error: 'Failed to verify payment', verified: false }
 *
 * Edge-cases & Notes:
 *   - The implementation is defensive: if eSewa confirms a payment but the
 *     booking document cannot be located or DB updates fail, the system still
 *     logs the payment (via `logPayment`) to preserve an audit trail and avoid
 *     losing confirmed payments.
 *   - Duplicate confirmation attempts are handled idempotently: if booking is
 *     already confirmed, the route logs the payment and returns `alreadyConfirmed: true`.
 *   - The booking lookup attempts multiple strategies to support variations in
 *     stored transactionUuid formats (legacy or new).
 *   - The code currently uses `ESEWA_SECRET_KEY` to sign verification messages
 *     and `ESEWA_VERIFY_URL` for the verification call. Ensure env vars are set.
 *
 * Example request:
 *   POST /api/payment/verify
 *   {
 *     "transactionUuid": "booking123_1690000000000",
 *     "productCode": "EPAYTEST",
 *     "totalAmount": 200
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ESEWA_VERIFY_URL, ESEWA_SECRET_KEY } from "@/lib/esewa/config";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { bookSlot } from "@/lib/slotService.admin";
import { logPayment } from "@/lib/paymentLogger";
import { computeAmountsFromBooking } from "@/lib/pricing/pricing";

interface EsewaVerificationResponse {
  product_code: string;
  total_amount: string | number;
  transaction_uuid: string;
  status: "COMPLETE" | "PENDING" | "FAILED" | "INITIATED";
  ref_id: string;
}

/**
 * Generate signature for verification request
 */
function generateVerificationSignature(transactionUuid: string): string {
  const message = `transaction_uuid=${transactionUuid}`;
  const hmac = crypto.createHmac("sha256", ESEWA_SECRET_KEY);
  hmac.update(message);
  return hmac.digest("base64");
}

// Helper: locate booking by transaction UUID with multiple strategies.
async function locateBookingByTxn(rawTxn: string) {
  const coll = db.collection("bookings");
  let bookingRef = coll.doc(rawTxn);
  let bookingSnap = await bookingRef.get();

  if (!bookingSnap.exists && rawTxn.includes("_")) {
    const prefixId = rawTxn.substring(0, rawTxn.lastIndexOf("_"));
    bookingRef = coll.doc(prefixId);
    bookingSnap = await bookingRef.get();
  }

  if (!bookingSnap.exists) {
    const q = await coll
      .where("esewaTransactionUuid", "==", rawTxn)
      .limit(1)
      .get();
    if (!q.empty) {
      bookingSnap = q.docs[0];
      bookingRef = coll.doc(bookingSnap.id);
    }
  }

  return { bookingRef, bookingSnap };
}

// Helper: mark booking as failed/cancelled (server-side update)
async function markBookingFailed(bookingRef: any, reason: string) {
  await bookingRef.update({
    status: "payment_failed",
    verificationFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    verificationFailureReason: reason,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionUuid, productCode, totalAmount } = body;

    console.log("🔍 Verification request:", {
      transactionUuid,
      productCode,
      totalAmount,
    });

    // Validate required parameters
    if (!transactionUuid || !productCode) {
      return NextResponse.json(
        { error: "Missing required parameters: transactionUuid, productCode" },
        { status: 400 },
      );
    }

    // Validate secret key is configured
    if (!ESEWA_SECRET_KEY) {
      console.error("ESEWA_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 500 },
      );
    }

    // Generate signature for verification
    const signature = generateVerificationSignature(transactionUuid);

    // Prepare verification request
    // Normalize totalAmount: remove trailing .0 or .00 if it's an integer value
    // eSewa might return 200.0 but expects 200 in verification if that's what was signed/initiated.
    const normalizedAmount = Number(totalAmount);
    // Use the normalized amount for verification URL
    const verifyUrl = `${ESEWA_VERIFY_URL}?product_code=${productCode}&total_amount=${normalizedAmount}&transaction_uuid=${transactionUuid}`;

    console.log("📡 Calling eSewa verify URL:", verifyUrl);

    const verifyResponse = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error("❌ eSewa verification failed:", errorText);
      return NextResponse.json(
        {
          error: "Payment verification failed",
          details: errorText,
          verified: false,
          status: "FAILED", // Explicit status for client
        },
        { status: 400 },
      );
    }

    const verificationData: EsewaVerificationResponse =
      await verifyResponse.json();
    console.log("✅ eSewa verification response:", verificationData);

    // Check if payment was completed
    const isVerified = verificationData.status === "COMPLETE";

    if (!isVerified) {
      console.log("⚠️ Payment not complete, status:", verificationData.status);

      // For non-verified statuses, be conservative: do NOT delete or remove
      // the booking/held record. Only mark the booking as failed for explicit
      // terminal statuses (e.g. CANCELED, FAILED). If eSewa returns NOT_FOUND
      // or PENDING, leave the booking as `pending_payment` so the user can
      // retry or cancel the hold manually from the UI.
      const terminalFailureStatuses = ["CANCELED", "FAILED"];
      const rawTxn = verificationData.transaction_uuid;

      try {
        const { bookingRef, bookingSnap } = await locateBookingByTxn(rawTxn);

        const bookingId = bookingSnap?.exists
          ? bookingRef.id
          : rawTxn.includes("_")
            ? rawTxn.substring(0, rawTxn.lastIndexOf("_"))
            : rawTxn;

        if (
          bookingSnap?.exists &&
          terminalFailureStatuses.includes(verificationData.status)
        ) {
          // Terminal failure: mark booking as failed (but do not delete).
          await markBookingFailed(bookingRef, verificationData.status);
          return NextResponse.json({
            verified: false,
            status: verificationData.status,
            transactionUuid: verificationData.transaction_uuid,
            refId: verificationData.ref_id,
            totalAmount: verificationData.total_amount,
            productCode: verificationData.product_code,
            bookingUpdated: true,
            bookingId,
          });
        }

        // Non-terminal (e.g. NOT_FOUND, PENDING) — keep the booking untouched
        // and return a clear response so the UI can show "Payment not done".
        return NextResponse.json({
          verified: false,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingFound: bookingSnap?.exists || false,
          bookingId: bookingId,
          message:
            "Payment not completed; booking retained (no automatic deletion).",
        });
      } catch (err) {
        console.warn("Failed to handle non-verified payment:", err);
        return NextResponse.json({
          verified: false,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
        });
      }
    }

    // Payment is verified, now update the booking in Firestore
    console.log("💾 Updating booking in database...");

    try {
      // Extract bookingId from transactionUuid (format: bookingId_timestamp)
      // If no underscore, assume it's just the bookingId (backward compatibility)
      // Locate booking: prefer exact match, then prefix-before-last-underscore,
      // then query by `esewaTransactionUuid` field.
      const rawTxn = transactionUuid;
      let bookingRef = db.collection("bookings").doc(rawTxn);
      console.log("booking1");
      let bookingSnap = await bookingRef.get();

      if (!bookingSnap.exists && rawTxn.includes("_")) {
        const prefixId = rawTxn.substring(0, rawTxn.lastIndexOf("_"));
        bookingRef = db.collection("bookings").doc(prefixId);
        bookingSnap = await bookingRef.get();
      }

      if (!bookingSnap.exists) {
        const q = await db
          .collection("bookings")
          .where("esewaTransactionUuid", "==", rawTxn)
          .limit(1)
          .get();
        if (!q.empty) {
          bookingSnap = q.docs[0];
          bookingRef = db.collection("bookings").doc(bookingSnap.id);
        }
      }
      console.log("booking2");

      // Resolve bookingId for later logging/response use (prefer found doc id)
      const bookingId = bookingSnap.exists
        ? bookingRef.id
        : rawTxn.includes("_")
          ? rawTxn.substring(0, rawTxn.lastIndexOf("_"))
          : rawTxn;

      // If booking is not found, don't treat this as a hard failure.
      // eSewa has confirmed the payment, so we should record the payment
      // and return success to avoid losing the confirmed payment.
      if (!bookingSnap.exists) {
        console.warn("⚠️ Booking not found in database:", bookingId);

        // Log payment record so there's an audit trail even if booking is missing
        await logPayment({
          transactionUuid: verificationData.transaction_uuid,
          bookingId: bookingId,
          userId: "",
          venueId: "",
          amount: parseFloat(
            String(verificationData.total_amount).replace(/,/g, ""),
          ),
          status: "success",
          method: "esewa",
          productCode: verificationData.product_code,
          refId: verificationData.ref_id,
          metadata: {
            note: "esewa confirmed but booking document missing",
            esewaStatus: verificationData.status,
          },
        });

        return NextResponse.json({
          verified: true,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingFound: false,
          message:
            "Payment verified but booking document not found; payment logged for manual reconciliation",
        });
      }

      const booking = bookingSnap.data();
      console.log("booking3");

      // Check if already confirmed to prevent duplicate processing
      if (booking.status === "confirmed") {
        console.log("ℹ️ Booking already confirmed");
        // Still ensure payment is logged (idempotent):
        await logPayment({
          transactionUuid: verificationData.transaction_uuid,
          bookingId: bookingId,
          userId: booking.userId || "",
          venueId: booking.venueId || "",
          amount: parseFloat(
            String(verificationData.total_amount).replace(/,/g, ""),
          ),
          status: "success",
          method: "esewa",
          productCode: verificationData.product_code,
          refId: verificationData.ref_id,
          metadata: {
            esewaStatus: verificationData.status,
            alreadyConfirmed: true,
          },
        });

        const computedAlready = computeAmountsFromBooking(booking);
        return NextResponse.json({
          verified: true,
          status: "COMPLETE",
          alreadyConfirmed: true,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingData: {
            bookingId,
            venueId: booking.venueId,
            userId: booking.userId,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            amount: booking.amount,
            bookingType: booking.bookingType,
            advanceAmount: computedAlready.advanceAmount,
            dueAmount:
              computedAlready.totalAmount - computedAlready.advanceAmount,
          },
        });
      }

      console.log("📄 Booking data:", booking);

      try {
        // Convert hold to confirmed booking in venueSlots
        console.log("🔄 Converting hold to confirmed booking...");
        await bookSlot(booking.venueId, booking.date, booking.startTime, {
          bookingId: bookingId,
          bookingType: "website",
          status: "confirmed",
          userId: booking.userId,
        });

        // Update booking document
        console.log("✅ Updating booking document...");
        await bookingRef.update({
          status: "confirmed",
          paymentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
          esewaTransactionCode: verificationData.ref_id,
          esewaTransactionUuid: verificationData.transaction_uuid,
          esewaStatus: verificationData.status,
          esewaAmount: verificationData.total_amount,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log payment to history
        await logPayment({
          transactionUuid: verificationData.transaction_uuid,
          bookingId: bookingId,
          userId: booking.userId,
          venueId: booking.venueId,
          amount: parseFloat(
            String(verificationData.total_amount).replace(/,/g, ""),
          ),
          status: "success",
          method: "esewa",
          productCode: verificationData.product_code,
          refId: verificationData.ref_id,
          metadata: {
            esewaStatus: verificationData.status,
            bookingDate: booking.date,
            bookingTime: booking.startTime,
          },
        });

        console.log(
          "🎉 Payment verification and booking confirmation complete!",
        );

        return NextResponse.json({
          verified: true,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingConfirmed: true,
          bookingData: {
            bookingId,
            venueId: booking.venueId,
            userId: booking.userId,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            amount: booking.amount,
            bookingType: booking.bookingType,
          },
        });
      } catch (innerDbError) {
        console.error(
          "❌ Database update error during confirmation:",
          innerDbError,
        );

        // Log payment so we keep an audit of successful payment even if DB update failed
        try {
          await logPayment({
            transactionUuid: verificationData.transaction_uuid,
            bookingId: bookingId,
            userId: booking.userId || "",
            venueId: booking.venueId || "",
            amount: parseFloat(
              String(verificationData.total_amount).replace(/,/g, ""),
            ),
            status: "success",
            method: "esewa",
            productCode: verificationData.product_code,
            refId: verificationData.ref_id,
            metadata: {
              esewaStatus: verificationData.status,
              dbError: String(innerDbError),
            },
          });
        } catch (logErr) {
          console.error("❌ Failed to log payment after DB error:", logErr);
        }

        // Return success response to eSewa to indicate verification was received.
        return NextResponse.json({
          verified: true,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingConfirmed: false,
          bookingUpdateFailed: true,
          message:
            "Payment verified but failed to update booking; payment logged for manual reconciliation",
        });
      }
    } catch (dbError) {
      console.error("❌ Database update error:", dbError);
      return NextResponse.json(
        {
          verified: true,
          status: verificationData.status,
          error: "Payment verified but booking update failed",
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    return NextResponse.json(
      {
        error: "Failed to verify payment",
        verified: false,
      },
      { status: 500 },
    );
  }
}
