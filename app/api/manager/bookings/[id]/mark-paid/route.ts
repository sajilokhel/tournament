/**
 * POST /api/manager/bookings/[id]/mark-paid
 *
 * Manager-only: marks a booking's due amount as paid, logs a duePayments record.
 * Body: { paymentMethod: "cash" | "online" }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyRequestToken, requireAdminSDK } from "@/lib/server/auth";
import { COLLECTIONS } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  const authResult = await verifyRequestToken(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid: managerId } = authResult;

  const { id: bookingId } = await params;
  const body = await request.json();
  const { paymentMethod } = body;

  if (!["cash", "online"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid paymentMethod" }, { status: 400 });
  }

  const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const booking = bookingSnap.data() as any;

  // Verify caller manages this venue
  const venueSnap = await db.collection(COLLECTIONS.VENUES).doc(booking.venueId).get();
  if (!venueSnap.exists) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }
  const venueData = venueSnap.data() as any;
  const managedBy = venueData?.managedBy;
  const isVenueManager =
    managedBy === managerId ||
    (Array.isArray(managedBy) && managedBy.includes(managerId));
  if (!isVenueManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const paidAmount: number = booking.dueAmount || 0;

  // Atomic batch: update booking + insert duePayments log
  const batch = db.batch();

  batch.update(bookingRef, {
    paymentStatus: "full",
    duePaymentMethod: paymentMethod,
    duePaidAt: FieldValue.serverTimestamp(),
    dueAmount: 0,
  });

  // Resolve user info for the log
  let userName = booking.customerName || "";
  let userEmail = "";
  if (booking.userId) {
    try {
      const userSnap = await db.collection(COLLECTIONS.USERS).doc(booking.userId).get();
      if (userSnap.exists) {
        const ud = userSnap.data() as any;
        userName = ud?.displayName || ud?.name || userName;
        userEmail = ud?.email || "";
      }
    } catch {
      // non-fatal
    }
  }

  const duePayRef = db.collection(COLLECTIONS.DUE_PAYMENTS).doc();
  batch.set(duePayRef, {
    bookingId,
    venueId: booking.venueId,
    venueName: venueData?.name || "",
    userId: booking.userId || null,
    userName,
    userEmail,
    managerId,
    amount: paidAmount,
    paymentMethod,
    bookingDate: booking.date || "",
    bookingStartTime: booking.startTime || "",
    bookingEndTime: booking.endTime || "",
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return NextResponse.json({ ok: true, bookingId, paidAmount });
}
