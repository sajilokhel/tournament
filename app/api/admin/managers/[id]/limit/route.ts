/**
 * PATCH /api/admin/managers/[id]/limit
 *
 * Admin-only: updates the cancellationHoursLimit for a manager.
 * Body: { "hours": number }
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

  const { id: managerId } = await params;
  const body = await request.json();
  const { hours } = body;

  if (typeof hours !== "number" || isNaN(hours) || hours < 0) {
    return NextResponse.json({ error: "Invalid hours value" }, { status: 400 });
  }

  const managerRef = db.collection(COLLECTIONS.USERS).doc(managerId);
  const snap = await managerRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  await managerRef.update({ cancellationHoursLimit: hours });

  return NextResponse.json({ ok: true, managerId, cancellationHoursLimit: hours });
}
