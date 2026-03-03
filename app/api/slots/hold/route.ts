/*
 * POST /api/slots/hold
 *
 * Description:
 *   Place a temporary hold on a specific slot. This endpoint marks the slot
 *   as HELD, creates a booking document with status "PENDING_PAYMENT", and
 *   mirrors the hold into the canonical `venueSlots` (via helper).
 *
 * Authentication:
 *   - Requires an Authorization header with a Firebase ID token:
 *       Authorization: Bearer <idToken>
 *   - The token is verified server-side and the UID is used as the hold owner.
 *
 * Request body (JSON):
 *   {
 *     "slotId": string,               // required - document id in `slots` collection
 *     "venueId": string,              // required - venue id used for venueSlots mirroring
 *     "holdDurationMinutes": number   // optional - default 5 (minutes)
 *   }
 *
 * Successful response:
 *   Status: 200
 *   Body:
 *     { ok: true, bookingId: "<generated_booking_id>" }
 *
 * Error responses (examples):
 *   - 400 Bad Request
 *     { error: "Missing required fields: slotId, venueId" }
 *     When required fields are not provided.
 *
 *   - 401 Unauthorized
 *     { error: "Unauthorized" } or { error: "Invalid token" }
 *     When Authorization header is missing/invalid or token verification fails.
 *
 *   - 404 Not Found
 *     { error: "Slot not found" }
 *     When the slot document does not exist.
 *
 *   - 409 Conflict
 *     { error: "Slot not available" } or { error: "Slot currently held" }
 *     When slot is not in AVAILABLE/expired-held state.
 *
 *   - 500 Internal Server Error
 *     { error: "Internal server error" }
 *     For unexpected conditions.
 *
 * Side-effects / Behavior details:
 *   - Verifies SDK initialization via `isAdminInitialized()`.
 *   - Validates request body for `slotId` and `venueId`.
 *   - Verifies the caller's Firebase ID token to obtain UID.
 *   - Runs a Firestore transaction:
 *       * Reads `slots/{slotId}` and checks `status`.
 *       * If available (or held but expired) it:
 *           - Creates a booking doc (status: PENDING_PAYMENT, bookingExpiresAt set)
 *           - Updates `slots/{slotId}` to status HELD, sets heldBy, holdExpiresAt, bookingId, updatedAt
 *       * Mirrors the hold into `venueSlots` using `holdSlot` helper (best-effort; non-fatal).
 *
 * Notes / Edge cases:
 *   - If the slot is HELD but the hold has expired, this endpoint will allow the new hold.
 *   - The created booking id is returned to the client and is used later for payment initiation.
 *   - The `holdSlot` helper call is wrapped in try/catch and logged as non-fatal — failure there doesn't rollback the transaction.
 */
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db } from "@/lib/firebase-admin";
import { holdSlot } from "@/lib/slotService.admin";
import { verifyRequestToken, requireAdminSDK } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  try {
    const body = await request.json();
    const { slotId, venueId, holdDurationMinutes = 5 } = body;

    if (!slotId || !venueId) {
      return NextResponse.json(
        { error: "Missing required fields: slotId, venueId" },
        { status: 400 },
      );
    }

    // Authenticate user via Bearer token
    const authResult = await verifyRequestToken(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const result = await db.runTransaction(async (tx) => {
      const slotRef = db.collection(COLLECTIONS.SLOTS).doc(slotId);
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) throw { status: 404, message: "Slot not found" };

      const slotData = slotSnap.data() as any;
      const status = (slotData.status || "").toString().toUpperCase();

      // Check if held/booked
      if (status && status !== "AVAILABLE") {
        // If HELD but expired, allow; otherwise reject
        if (status !== "HELD")
          throw { status: 409, message: "Slot not available" };
        const expires = slotData.holdExpiresAt;
        if (
          expires &&
          expires.toMillis &&
          expires.toMillis() > admin.firestore.Timestamp.now().toMillis()
        ) {
          throw { status: 409, message: "Slot currently held" };
        }
      }

      const now = admin.firestore.Timestamp.now();
      const holdExpiresAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + holdDurationMinutes * 60 * 1000,
      );

      const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc();
      const bookingData: any = {
        venueId,
        userId: uid,
        slotId,
        status: "PENDING_PAYMENT",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        bookingExpiresAt: holdExpiresAt,
      };
      tx.set(bookingRef, bookingData);

      // Mirror hold into canonical venueSlots document
      try {
        const slotAfter = await db.collection(COLLECTIONS.SLOTS).doc(slotId).get();
        if (slotAfter.exists) {
          const s = slotAfter.data();
          await holdSlot(
            venueId,
            s.date,
            s.startTime,
            uid,
            bookingRef.id,
            holdDurationMinutes,
          );
        }
      } catch (e) {
        console.warn("holdSlot helper failed (non-fatal):", e);
      }

      tx.update(slotRef, {
        status: "HELD",
        heldBy: uid,
        holdExpiresAt,
        bookingId: bookingRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { bookingId: bookingRef.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("/api/slots/hold error:", err);
    if (err && err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
