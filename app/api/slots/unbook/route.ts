/*
 * POST /api/slots/unbook
 *
 * Description:
 *   Allows a venue manager or admin to remove a physical booking and free up
 *   the associated slot. This is intended for on-site/manager operations where
 *   a booking (created as `physical` type) was added and needs to be removed.
 *
 * Authentication / Authorization:
 *   - Requires a Bearer token in `Authorization` header.
 *   - The token is verified via Firebase Admin; the caller must have role
 *     `manager` or `admin` (checked by reading `users/{uid}.role`).
 *
 * Request body (JSON):
 *   {
 *     "slotId": string,     // ID of the slot document (slots/{slotId})
 *     "bookingId": string,  // ID of the booking to remove (bookings/{bookingId})
 *     "venueId": string     // ID of the venue (used to update canonical venueSlots)
 *   }
 *
 * Behavior / Side-effects:
 *   - Verifies Admin SDK initialized.
 *   - Verifies Authorization Bearer token and caller role.
 *   - Runs a Firestore transaction:
 *       * Ensures booking exists and is of type "physical".
 *       * Deletes booking document.
 *       * Updates the corresponding `slots/{slotId}` document setting:
 *           status: "AVAILABLE"
 *           bookingId: <deleted> (FieldValue.delete())
 *           updatedAt: server timestamp
 *   - Attempts to keep `venueSlots/{venueId}` canonical by calling
 *     `unbookSlot(venueId, date, startTime)` with booking date/time if present.
 *
 * Successful Response (200):
 *   { "ok": true }
 *
 * Failure responses:
 *   - 400 Bad Request
 *     { "error": "Missing fields" }
 *     When required body fields are not provided.
 *
 *   - 401 Unauthorized
 *     { "error": "Unauthorized" } or { "error": "Invalid token" }
 *     When Authorization header missing or token verification fails.
 *
 *   - 403 Forbidden
 *     { "error": "Forbidden" }
 *     When the caller is not a manager or admin.
 *
 *   - 404 Not Found
 *     { "error": "Booking not found" }
 *     When the specified booking document does not exist.
 *
 *   - 409 Conflict / 400
 *     { "error": "Only physical bookings can be removed by manager" }
 *     When the booking exists but is not of type `physical`.
 *
 *   - 500 Internal Server Error
 *     { "error": "Internal server error" }
 *     For unexpected server/database errors.
 *
 * Notes:
 *   - This endpoint is intentionally restrictive: it only allows removal of
 *     `physical` bookingType by authorized managers/admins. It will not remove
 *     bookings that were created via online flows unless their bookingType is
 *     explicitly `physical`.
 *   - The function logs (and proceeds) if `unbookSlot` helper fails; that
 *     cleanup is considered non-fatal.
 */

import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";
import { unbookSlot } from "@/lib/slotService.admin";

async function callerIsManagerOrAdmin(uid: string) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return false;
    const r = doc.data()?.role;
    return r === "manager" || r === "admin";
  } catch (e) {
    console.warn("Failed to check caller role", e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { slotId, bookingId, venueId } = body;
    if (!slotId || !bookingId || !venueId)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const authHeader = request.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const idToken = match[1];

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const uid = decoded.uid;
    const allowed = await callerIsManagerOrAdmin(uid);
    if (!allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const txResult = await db.runTransaction(async (tx) => {
      const bookingRef = db.collection("bookings").doc(bookingId);
      const slotRef = db.collection("slots").doc(slotId);

      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists)
        throw { status: 404, message: "Booking not found" };

      const bookingData = bookingSnap.data() as any;
      if (bookingData.bookingType !== "physical")
        throw {
          status: 400,
          message: "Only physical bookings can be removed by manager",
        };

      tx.delete(bookingRef);
      tx.update(slotRef, {
        status: "AVAILABLE",
        bookingId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { bookingData };
    });

    // Keep venueSlots canonical: remove booking from venueSlots bookings array
    try {
      if (
        txResult &&
        txResult.bookingData &&
        txResult.bookingData.date &&
        txResult.bookingData.startTime
      ) {
        await unbookSlot(
          venueId,
          txResult.bookingData.date,
          txResult.bookingData.startTime,
        );
      }
    } catch (e) {
      console.warn("unbookSlot helper failed (non-fatal):", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/slots/unbook error:", err);
    if (err && err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
