/**
 * DELETE /api/admin/users/[id]
 *
 * Admin-only: deletes a user document from Firestore.
 * Does NOT delete the Firebase Auth account.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { extractBearerToken, getUserRole, requireAdminSDK } from "@/lib/server/auth";
import { COLLECTIONS } from "@/lib/utils";

export async function DELETE(
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

  const { id: targetUid } = await params;

  // Prevent deleting other admins
  const targetRole = await getUserRole(targetUid);
  if (targetRole === "admin") {
    return NextResponse.json({ error: "Cannot delete an admin account." }, { status: 403 });
  }

  await db.collection(COLLECTIONS.USERS).doc(targetUid).delete();

  return NextResponse.json({ ok: true, deleted: targetUid });
}
