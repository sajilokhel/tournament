/**
 * GET /api/managers/:id/stats
 *
 * Returns computed financial stats for a manager.
 * Callable by:
 *   - Admin (role === "admin")
 *   - The manager themselves (uid === id)
 *
 * Response shape:
 * {
 *   stats: {
 *     totalBookings, physicalBookings, onlineBookings,
 *     totalIncome,     // face value of all confirmed bookings
 *     physicalIncome,  // cash collected by manager from walk-in bookings
 *     onlineIncome,    // advance actually collected via eSewa
 *     safeOnlineIncome,// online income past the cancellation window
 *     commissionPercentage,
 *     commissionAmount,
 *     netIncome,       // onlineIncome - commissionAmount
 *   },
 *   derived: {
 *     totalPaidOut,           // amount already paid out to manager
 *     heldByManager,          // physicalIncome + totalPaidOut
 *     heldByAdmin,            // onlineIncome - totalPaidOut
 *     totalToBePaid,          // = heldByAdmin
 *     actualPaymentToBePaid,  // safeOnlineIncome - totalPaidOut
 *   },
 *   cancellationLimit,        // hours before booking that cancellation is blocked
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyRequestToken, getUserRole, requireAdminSDK } from "@/lib/server/auth";
import { calculateCommission, getVenuePlatformCommission } from "@/lib/commission";
import { DEFAULT_CANCELLATION_HOURS, COLLECTIONS } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  try {
    const { id: managerId } = await params;

    const authResult = await verifyRequestToken(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    // Allow admin OR the manager themselves
    const role = await getUserRole(uid);
    if (role !== "admin" && uid !== managerId) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // 1. Fetch manager user doc
    const managerSnap = await db.collection(COLLECTIONS.USERS).doc(managerId).get();
    if (!managerSnap.exists) {
      return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    }
    const managerData = managerSnap.data() as any;
    const cancellationLimit: number =
      managerData.cancellationHoursLimit ?? DEFAULT_CANCELLATION_HOURS;
    const totalPaidOut: number = managerData.totalPaidOut ?? 0;

    // 2. Fetch all venues managed by this manager
    const venuesSnap = await db
      .collection(COLLECTIONS.VENUES)
      .where("managedBy", "==", managerId)
      .get();

    if (venuesSnap.empty) {
      // No venues — return zeros
      return NextResponse.json(buildResponse(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, totalPaidOut, cancellationLimit));
    }

    const venueIds = venuesSnap.docs.map((d) => d.id);

    // commission: use first venue's platformCommission (or 0)
    const firstVenueData = venuesSnap.docs[0].data() as any;
    const commissionPercentage = getVenuePlatformCommission(firstVenueData);

    // 3. Fetch all confirmed/completed bookings for these venues (batch in chunks of 10)
    const allBookings: any[] = [];
    for (let i = 0; i < venueIds.length; i += 10) {
      const chunk = venueIds.slice(i, i + 10);
      const snap = await db
        .collection(COLLECTIONS.BOOKINGS)
        .where("venueId", "in", chunk)
        .where("status", "in", ["confirmed", "completed"])
        .get();
      snap.forEach((d) => allBookings.push(d.data()));
    }

    // 4. Aggregate
    let totalBookings = 0;
    let physicalBookings = 0;
    let onlineBookings = 0;
    let totalIncome = 0;
    let physicalIncome = 0;
    let onlineIncome = 0;
    let safeOnlineIncome = 0;

    const now = new Date();

    for (const b of allBookings) {
      totalBookings++;
      const amount = Number(b.amount || b.price || 0);
      totalIncome += amount;

      const method = (b.bookingType || "").toLowerCase();
      const isOnline = method === "website" || method === "app";

      if (isOnline) {
        onlineBookings++;
        // advanceAmount = what was actually collected via eSewa
        const advance = Number(b.advanceAmount ?? b.amount ?? b.price ?? 0);
        onlineIncome += advance;

        // Safe = booking is in the past or within the cancellation window (user can no longer cancel)
        const bookingDateTime = new Date(`${b.date}T${b.startTime}`);
        const diffHours = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffHours < cancellationLimit) {
          safeOnlineIncome += advance;
        }
      } else {
        physicalBookings++;
        physicalIncome += amount;
      }
    }

    // 5. Commission — applied to online income only (what the platform holds)
    const commission = calculateCommission(onlineIncome, commissionPercentage);

    return NextResponse.json(
      buildResponse(
        totalBookings, physicalBookings, onlineBookings,
        totalIncome, physicalIncome, onlineIncome, safeOnlineIncome,
        commissionPercentage, commission.commissionAmount, commission.netRevenue,
        totalPaidOut, cancellationLimit,
      )
    );
  } catch (err: any) {
    console.error("Manager stats error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

function buildResponse(
  totalBookings: number,
  physicalBookings: number,
  onlineBookings: number,
  totalIncome: number,
  physicalIncome: number,
  onlineIncome: number,
  safeOnlineIncome: number,
  commissionPercentage: number,
  commissionAmount: number,
  netIncome: number,
  totalPaidOut: number,
  cancellationLimit: number,
) {
  const heldByManager = physicalIncome + totalPaidOut;
  const heldByAdmin = onlineIncome - totalPaidOut;
  const actualPaymentToBePaid = safeOnlineIncome - totalPaidOut;

  return {
    stats: {
      totalBookings,
      physicalBookings,
      onlineBookings,
      totalIncome,
      physicalIncome,
      onlineIncome,
      safeOnlineIncome,
      commissionPercentage,
      commissionAmount,
      netIncome,
    },
    derived: {
      totalPaidOut,
      heldByManager,
      heldByAdmin,
      totalToBePaid: heldByAdmin,
      actualPaymentToBePaid,
    },
    cancellationLimit,
  };
}
