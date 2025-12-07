/**
 * POST /api/bookings/:id/cancel
 *
 * Description:
 *   Endpoint to cancel an existing booking by its id. This route uses
 *   the Admin Firestore SDK to atomically update booking state and keep
 *   the canonical `venueSlots` document in sync (removing bookings/held
 *   entries for the cancelled slot).
 *
 * Authentication / Authorization:
 *   - This route expects the caller to provide the `userId` of the
 *     booking owner in the request body and the server trusts that
 *     value to confirm ownership. (Note: for stronger security, prefer
 *     verifying an auth token and comparing the token uid with the
 *     booking userId.)
 *
 * Request:
 *   - Method: POST
 *   - Path params:
 *       - id (string) - Booking document id (from the route param)
 *   - Body (JSON):
 *       {
 *         "userId": "uid-of-caller"
 *       }
 *
 * Behavior / Side-effects:
 *   - Loads booking document `bookings/{id}` from Firestore.
 *   - Verifies the booking exists.
 *   - Verifies the provided `userId` matches booking.userId (ownership).
 *   - Loads the venue document to read `managedBy` and then reads the
 *     manager user doc (if present) to check `cancellationHoursLimit`.
 *     If not set, a default of 5 hours is applied.
 *   - Computes time difference between booking start (combining
 *     booking.date and booking.startTime) and now. If the booking start
 *     is within `cancellationHoursLimit`, cancellation is rejected.
 *   - If allowed, updates booking document setting:
 *       status: "cancelled"
 *       cancelledAt: server timestamp
 *   - If booking has a venue/date/startTime, it opens a transaction to
 *     update `venueSlots/{venueId}` document, removing matching entries
 *     from `bookings` and `held` arrays and updating `updatedAt`.
 *
 * Possible Responses (examples reflect actual behaviors in code):
 *
 * 1) Success - booking cancelled
 *    Status: 200
 *    Body:
 *      { "success": true }
 *
 * 2) Booking not found
 *    Status: 404
 *    Body:
 *      { "error": "Booking not found" }
 *
 * 3) Unauthorized (ownership mismatch)
 *    Status: 403
 *    Body:
 *      { "error": "Unauthorized" }
 *
 * 4) Cancellation window violated (too close to start time)
 *    Status: 400
 *    Body:
 *      {
 *        "error": "Cannot cancel booking within X hours of start time.",
 *        "canCancel": false
 *      }
 *    Notes:
 *      - X is the `cancellationHoursLimit` read from the venue manager
 *        document, or 5 if not configured.
 *
 * 5) Internal server error / invalid request parsing
 *    Status: 500
 *    Body:
 *      { "error": "<error message>" }
 *
 * Examples:
 *
 * 1) Request to cancel:
 *    POST /api/bookings/abc123/cancel
 *    Body:
 *      { "userId": "user_foo" }
 *
 * 2) Response if success:
 *      { "success": true }
 *
 * 3) Response if too late to cancel:
 *      { "error": "Cannot cancel booking within 5 hours of start time.", "canCancel": false }
 *
 * Implementation notes / edge-cases:
 *   - The route trusts `booking.date` and `booking.startTime` are in a
 *     parseable format for `new Date(\`\${date}T\${startTime}\`)`. If the
 *     stored format differs or timezone handling is required, adapt
 *     parsing accordingly.
 *   - The code fetches the venue, then the manager's user doc (if
 *     managedBy present) to read `cancellationHoursLimit`. If manager
 *     doc missing or setting absent, default is 5 hours.
 *   - After marking booking cancelled, the function attempts to remove
 *     entries from the canonical `venueSlots` document. If
 *     `venueSlots` doc doesn't exist it simply skips.
 *   - There is no explicit authentication in the current code path;
 *     consider validating an Authorization token and comparing the uid
 *     server-side for production.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin"; // Use Admin SDK
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { userId } = body;

    const bookingRef = db.collection("bookings").doc(id);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingSnap.data();

    // Verify ownership
    if (booking?.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch venue to get manager settings
    const venueRef = db.collection("venues").doc(booking.venueId);
    const venueSnap = await venueRef.get();
    let cancellationLimit = 5; // Default

    if (venueSnap.exists) {
      const venue = venueSnap.data();
      if (venue?.managedBy) {
        const managerRef = db.collection("users").doc(venue.managedBy);
        const managerSnap = await managerRef.get();
        if (managerSnap.exists) {
          const managerData = managerSnap.data();
          if (managerData?.cancellationHoursLimit !== undefined) {
            cancellationLimit = managerData.cancellationHoursLimit;
          }
        }
      }
    }

    // Check cancellation limit rule
    const now = new Date();
    const bookingDateStr = booking.date;
    const bookingTimeStr = booking.startTime;
    const bookingDateTime = new Date(`${bookingDateStr}T${bookingTimeStr}`);

    const diffMs = bookingDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < cancellationLimit) {
      return NextResponse.json(
        {
          error: `Cannot cancel booking within ${cancellationLimit} hours of start time.`,
          canCancel: false,
        },
        { status: 400 },
      );
    }

    // Perform cancellation
    await bookingRef.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    // Release slot
    if (booking.venueId && booking.date && booking.startTime) {
      const venueSlotsRef = db.collection("venueSlots").doc(booking.venueId);

      await db.runTransaction(async (t) => {
        const doc = await t.get(venueSlotsRef);
        if (!doc.exists) return;

        const data = doc.data() as any;

        // Remove from bookings
        const bookings = (data.bookings || []).filter(
          (s: any) =>
            !(s.date === booking.date && s.startTime === booking.startTime),
        );

        // Remove from held
        const held = (data.held || []).filter(
          (s: any) =>
            !(s.date === booking.date && s.startTime === booking.startTime),
        );

        t.update(venueSlotsRef, {
          bookings,
          held,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cancellation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel" },
      { status: 500 },
    );
  }
}
