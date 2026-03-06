/**
 * PATCH /api/admin/bookings/[id]/status
 *
 * Admin-only: updates the status field of a booking document.
 * Body: { "status": string }
 */
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { extractBearerToken, getUserRole, requireAdminSDK } from "@/lib/server/auth";
import { COLLECTIONS } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let callerUid: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const callerRole = await getUserRole(callerUid);
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { id: bookingId } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || typeof status !== "string") {
    return NextResponse.json({ error: "Missing or invalid status" }, { status: 400 });
  }

  const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  await bookingRef.update({ status });

  return NextResponse.json({ ok: true, bookingId, status });
}
