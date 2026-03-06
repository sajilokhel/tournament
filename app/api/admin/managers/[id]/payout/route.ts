/**
 * POST /api/admin/managers/[id]/payout
 *
 * Admin-only: records a payout to a manager.
 * - Updates manager's totalPaidOut in users collection
 * - Creates a record in payouts collection
 *
 * Body: { amount: number, transactionId?: string, notes?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { extractBearerToken, getUserRole, requireAdminSDK } from "@/lib/server/auth";
import { COLLECTIONS } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let callerUid: string;
  let callerEmail: string | undefined;
  try {
    const decoded = await auth.verifyIdToken(token);
    callerUid = decoded.uid;
    callerEmail = decoded.email;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const callerRole = await getUserRole(callerUid);
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { id: managerId } = await params;
  const body = await request.json();
  const { amount, transactionId = "", notes = "" } = body;

  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const managerRef = db.collection(COLLECTIONS.USERS).doc(managerId);
  const managerSnap = await managerRef.get();
  if (!managerSnap.exists) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  const currentPaidOut: number = (managerSnap.data() as any)?.totalPaidOut || 0;
  const newPaidOut = currentPaidOut + amount;

  // Atomic batch: update user + add payout record
  const batch = db.batch();

  batch.update(managerRef, { totalPaidOut: newPaidOut });

  const payoutRef = db.collection(COLLECTIONS.PAYOUTS).doc();
  batch.set(payoutRef, {
    managerId,
    amount,
    date: FieldValue.serverTimestamp(),
    transactionId,
    notes,
    adminId: callerUid,
    adminEmail: callerEmail || "",
  });

  await batch.commit();

  return NextResponse.json({ ok: true, newPaidOut, payoutId: payoutRef.id });
}
