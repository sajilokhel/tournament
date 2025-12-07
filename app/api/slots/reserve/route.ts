/*
 * POST /api/slots/reserve
 *
 * Description:
 *   Reserve a slot on behalf of a customer. This endpoint is intended for
 *   venue managers or admins to create physical (walk-in / phone) reservations.
 *   It creates a booking document (bookingType: "physical") with status "confirmed"
 *   and updates the corresponding slot to status "RESERVED".
 *
 * Authentication:
 *   - Requires Authorization: Bearer <idToken>
 *   - The token must belong to a user with role "manager" or "admin".
 *
 * Request (JSON body):
 *   {
 *     "slotId": "<slot-doc-id>",
 *     "venueId": "<venue-id>",
 *     "customerName": "<customer's name>",
 *     "customerPhone": "<customer's phone>",
 *     "notes": "<optional notes>"
 *   }
 *
 * Success Response (200):
 *   { ok: true, bookingId: "<new-booking-id>" }
 *
 * Error responses (examples):
 *   - 400 Bad Request
 *     { error: "Missing required fields" }
 *     When required body fields are not provided.
 *
 *   - 401 Unauthorized
 *     { error: "Unauthorized" } or { error: "Invalid token" }
 *     When Authorization header is missing or token verification fails.
 *
 *   - 403 Forbidden
 *     { error: "Forbidden" }
 *     When the caller is authenticated but not a manager/admin.
 *
 *   - 404 Not Found
 *     { error: "Slot not found" } (status 404)
 *     When the referenced slot document does not exist.
 *
 *   - 409 Conflict
 *     { error: "Slot already booked" } (status 409)
 *     When the slot is already in a BOOKED state.
 *
 *   - 500 Internal Server Error
 *     { error: "Internal server error" }
 *
 * Side effects:
 *   - Creates a new document in `bookings` with bookingType "physical" and status "confirmed".
 *   - Updates the `slots/{slotId}` document to:
 *       { status: "RESERVED", bookingId: "<id>", updatedAt: <serverTimestamp> }
 *   - Attempts to update the canonical `venueSlots/{venueId}` via helper `reserveSlot` (non-fatal).
 *
 * Notes / Implementation details:
 *   - The endpoint reads slot data to populate booking date/startTime and to validate availability.
 *   - The transaction will throw structured errors `{ status, message }` in some cases;
 *     the route uses those to return appropriate HTTP statuses.
 *   - The canonical venueSlots update is best-effort and any failure there is logged but does not
 *     cause the reservation transaction to be rolled back.
 */
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";
import { reserveSlot } from "@/lib/slotService.admin";

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
    const { slotId, venueId, customerName, customerPhone, notes } = body;

    if (!slotId || !venueId || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

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

    const result = await db.runTransaction(async (tx) => {
      const slotRef = db.collection("slots").doc(slotId);
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) throw { status: 404, message: "Slot not found" };

      const slotData = slotSnap.data() as any;
      const status = (slotData.status || "").toString().toUpperCase();
      if (status === "BOOKED")
        throw { status: 409, message: "Slot already booked" };

      const bookingRef = db.collection("bookings").doc();
      const bookingData: any = {
        venueId,
        slotId,
        date: slotData.date,
        startTime: slotData.startTime,
        timeSlot: `${slotData.date} ${slotData.startTime} - ${slotData.endTime || ""}`,
        customerName,
        customerPhone,
        notes: notes || null,
        bookingType: "physical",
        status: "confirmed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      tx.set(bookingRef, bookingData);

      tx.update(slotRef, {
        status: "RESERVED",
        bookingId: bookingRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { bookingId: bookingRef.id };
    });

    // Also update the canonical venueSlots document (server-side helper)
    try {
      const slotAfter = await db.collection("slots").doc(slotId).get();
      if (slotAfter.exists) {
        const s = slotAfter.data();
        await reserveSlot(
          venueId,
          s.date,
          s.startTime,
          decoded.uid,
          customerPhone + (notes ? ` | ${notes}` : ""),
        );
      }
    } catch (e) {
      console.warn("reserveSlot helper failed (non-fatal):", e);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("/api/slots/reserve error:", err);
    if (err && err.status)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
