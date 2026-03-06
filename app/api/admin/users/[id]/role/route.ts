/**
 * PATCH /api/admin/users/[id]/role
 *
 * Admin-only endpoint to change a user's role in Firestore.
 * Uses the Admin SDK directly — bypasses Firestore client rules.
 *
 * Body: { "role": "user" | "manager" }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { extractBearerToken, getUserRole, requireAdminSDK } from "@/lib/server/auth";
import { auth } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  // Verify caller is admin
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

  const { id: targetUid } = await params;
  const body = await request.json();
  const { role } = body;

  if (!["user", "manager"].includes(role)) {
    return NextResponse.json({ error: "Invalid role. Must be 'user' or 'manager'." }, { status: 400 });
  }

  // Prevent demoting other admins
  const targetRole = await getUserRole(targetUid);
  if (targetRole === "admin") {
    return NextResponse.json({ error: "Cannot change role of an admin account." }, { status: 403 });
  }

  await db.collection(COLLECTIONS.USERS).doc(targetUid).update({ role });

  return NextResponse.json({ ok: true, uid: targetUid, role });
}
