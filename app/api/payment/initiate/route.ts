/*
 * POST /api/payment/initiate
 *
 * Description:
 *   Initiates an eSewa payment for a server-side booking. This endpoint:
 *     - Generates a unique transaction UUID for the booking.
 *     - Persists `esewaTransactionUuid` and `esewaInitiatedAt` on the booking document.
 *     - Attempts to attach the transaction UUID to the corresponding entry in the
 *       canonical `venueSlots` held list (so held slot entries are correlated).
 *     - Generates an HMAC-SHA256 signature (base64) required by eSewa and returns
 *       payment parameters the client can post to eSewa payment gateway.
 *
 * Authentication:
 *   - This implementation does not require an Authorization header. It relies on
 *     server-side Admin SDK access and writes directly to Firestore. In production,
 *     consider adding caller authentication if you need to restrict who can initiate
 *     payments (e.g., only the booking owner).
 *
 * Request:
 *   - Method: POST
 *   - Body (JSON):
 *       {
 *         "bookingId": "string"    // Booking document id (required)
 *       }
 *
 * Successful response (200):
 *   {
 *     "success": true,
 *     "transactionUuid": "<bookingId>_<timestamp>",
 *     "signature": "<base64-hmac-sha256>",
 *     "paymentParams": {
 *       amount: "<paidAmount as string>",
 *       totalAmount: "<paidAmount as string>",
 *       transactionUuid: "<transactionUuid>",
 *       productCode: "<ESEWA_MERCHANT_CODE>",
 *       successUrl: "<callback url>",
 *       failureUrl: "<callback url>"
 *     }
 *   }
 *
 * Failure responses (examples):
 *   - 400 Bad Request
 *     { "error": "Missing bookingId" }
 *     { "error": "Booking missing server-computed amounts" }
 *
 *   - 404 Not Found
 *     { "error": "Booking not found" }
 *
 *   - 500 Internal Server Error
 *     { "error": "Admin SDK not initialized" }
 *     { "error": "Payment gateway not configured" }
 *     { "error": "Failed to initiate payment" }
 *
 * Side effects / Notes:
 *   - The endpoint expects the booking document to contain server-computed amounts
 *     (e.g., `advanceAmount`). If those are missing, it will return 400 and not
 *     generate a transaction.
 *   - The code writes `esewaTransactionUuid` and `esewaInitiatedAt` to the booking
 *     document; if the booking references a venueSlots document, it will also attempt
 *     to annotate the held entry with the transaction UUID inside a transaction.
 *   - The generated signature uses the server secret `ESEWA_SECRET_KEY`. That secret
 *     must be configured on the server for the signature generation to work.
 *
 * Example:
 *   Request:
 *     POST /api/payment/initiate
 *     Body: { "bookingId": "abc123" }
 *
 *   Success:
 *     {
 *       "success": true,
 *       "transactionUuid": "abc123_1670000000000",
 *       "signature": "base64signature==",
 *       "paymentParams": { ... }
 *     }
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, isAdminInitialized } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import {
  ESEWA_MERCHANT_CODE,
  ESEWA_SECRET_KEY,
  getSuccessUrl,
  getFailureUrl,
} from "@/lib/esewa/config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    if (!isAdminInitialized()) {
      return NextResponse.json(
        { error: "Admin SDK not initialized" },
        { status: 500 },
      );
    }

    // Read booking
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingSnap.data() as any;

    // Booking must carry server-calculated amounts
    if (booking.advanceAmount == null) {
      return NextResponse.json(
        { error: "Booking missing server-computed amounts" },
        { status: 400 },
      );
    }

    // Generate transaction UUID
    const transactionUuid = `${bookingId}_${Date.now()}`;

    // Persist esewaTransactionUuid on booking and attach to held entry in venueSlots atomically
    if (booking.venueId) {
      const venueRef = db.collection("venueSlots").doc(booking.venueId);
      await db.runTransaction(async (t) => {
        const vSnap = await t.get(venueRef);
        if (!vSnap.exists) {
          // still update booking even if venueSlots missing
          t.update(bookingRef, {
            esewaTransactionUuid: transactionUuid,
            esewaInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }

        const vData = vSnap.data() as any;
        const held = (vData.held || []).map((h: any) => {
          if (h.bookingId === bookingId) {
            return { ...h, esewaTransactionUuid: transactionUuid };
          }
          return h;
        });

        t.update(venueRef, {
          held,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update booking as part of same transaction
        t.update(bookingRef, {
          esewaTransactionUuid: transactionUuid,
          esewaInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } else {
      // No venueId; just update booking
      await bookingRef.update({
        esewaTransactionUuid: transactionUuid,
        esewaInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Generate signature (use server-stored advanceAmount as the payment amount)
    if (!ESEWA_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 500 },
      );
    }

    const paidAmount = booking.advanceAmount; // amount to be charged now
    const message = `total_amount=${paidAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_MERCHANT_CODE}`;
    const hmac = crypto.createHmac("sha256", ESEWA_SECRET_KEY);
    hmac.update(message);
    const signature = hmac.digest("base64");

    return NextResponse.json({
      success: true,
      transactionUuid,
      signature,
      paymentParams: {
        amount: String(paidAmount),
        totalAmount: String(paidAmount),
        transactionUuid,
        productCode: ESEWA_MERCHANT_CODE,
        successUrl: getSuccessUrl(),
        failureUrl: getFailureUrl(),
      },
    });
  } catch (error) {
    console.error("Error initiating payment:", error);
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 },
    );
  }
}
