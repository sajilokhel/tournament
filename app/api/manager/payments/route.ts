/**
 * GET /api/manager/payments
 *
 * Returns the manager's eSewa payment transactions and due-amount payment logs.
 * Caller must be authenticated as the manager (or admin).
 *
 * Response:
 * {
 *   payments: PaymentRecord[],
 *   duePayments: DuePaymentRecord[],
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { verifyRequestToken, getUserRole, requireAdminSDK } from "@/lib/server/auth";
import { COLLECTIONS } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  const authResult = await verifyRequestToken(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  // Allow admin to query any manager; otherwise self only
  const role = await getUserRole(uid);
  const targetManagerId =
    role === "admin"
      ? (request.nextUrl.searchParams.get("managerId") ?? uid)
      : uid;

  // Fetch both collections in parallel using Admin SDK (bypasses Firestore rules)
  const [paymentsSnap, duePaymentsSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.PAYMENTS)
      .where("managerId", "==", targetManagerId)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get(),
    db
      .collection(COLLECTIONS.DUE_PAYMENTS)
      .where("managerId", "==", targetManagerId)
      .limit(200)
      .get(),
  ]);

  const payments = paymentsSnap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      // Convert Firestore Timestamps to ISO strings for safe JSON serialisation
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  const duePayments = duePaymentsSnap.docs
    .map((d: QueryDocumentSnapshot) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    })
    .sort((a: any, b: any) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );

  return NextResponse.json({ payments, duePayments });
}
