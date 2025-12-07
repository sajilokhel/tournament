/*
 * POST /api/payment/compute-amount
 *
 * Description:
 *   Computes pricing for a requested slot (or series of consecutive slots) or
 *   computes amounts from a provided booking preview. Also performs basic
 *   availability checks against the canonical `venueSlots` document.
 *
 * Authentication:
 *   - Current implementation does not require authentication. It reads venue
 *     and venueSlots using the Admin SDK. If needed, require a Bearer token
 *     and validate caller privileges before allowing availability checks.
 *
 * Request body (JSON) - supported variants:
 *
 * 1) Booking preview (calculates pricing from a booking object):
 *    {
 *      "booking": { ... } // any shape expected by computeAmountsFromBooking
 *    }
 *    Response: returns `computed` amounts derived from the booking object.
 *
 * 2) Slot-based calculation (checks availability + computes price):
 *    {
 *      "venueId": "string",      // required
 *      "date": "YYYY-MM-DD",     // required
 *      "startTime": "HH:mm",     // required
 *      "slots": 2                // optional, number of consecutive slots (default 1)
 *    }
 *    Response: returns availability flag, any conflicts and computed pricing
 *    using venue price and slot duration from the venueSlots config.
 *
 * Successful response (200):
 * {
 *   success: true,
 *   available: boolean,       // true when no conflicts found
 *   conflicts: string[],      // example: ['booked', 'held', 'blocked', 'reserved']
 *   computed: {               // output from computeAmountsFromVenue or computeAmountsFromBooking
 *     totalAmount: number,
 *     advanceAmount: number,
 *     // ... other breakdown fields
 *   },
 *   slotDuration: number,     // duration in minutes (from venue config)
 *   slotsCount: number
 * }
 *
 * Error responses:
 * - 400 Bad Request
 *   { error: 'Missing venueId, date or startTime' }
 * - 404 Not Found
 *   { error: 'Venue not found' } or { error: 'Venue slots not initialized' }
 * - 500 Internal Server Error
 *   { error: 'Failed to compute amount' }
 *
 * Notes:
 * - When checking `held` slots, the endpoint treats a hold as a conflict only
 *   if `holdExpiresAt` is in the future.
 * - The endpoint assumes `date` + `startTime` are provided in a parseable local
 *   format; if you require timezone-aware behavior, convert inputs accordingly.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, isAdminInitialized } from "@/lib/firebase-admin";
import {
  computeAmountsFromBooking,
  computeAmountsFromVenue,
} from "@/lib/pricing";
import { getVenueSlots } from "@/lib/slotService";

type RequestBody = {
  venueId?: string;
  date?: string;
  startTime?: string;
  slots?: number; // number of consecutive slots to book (default 1)
  booking?: any; // optional booking preview
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { venueId, date, startTime, slots, booking } = body as RequestBody;

    // If booking object provided directly, use it (useful for preview/testing)
    if (booking) {
      const computed = computeAmountsFromBooking(booking);
      return NextResponse.json({ success: true, computed });
    }

    if (!venueId || !date || !startTime) {
      return NextResponse.json(
        { error: "Missing venueId, date or startTime" },
        { status: 400 },
      );
    }

    if (!isAdminInitialized()) {
      return NextResponse.json(
        { error: "Admin SDK not initialized" },
        { status: 500 },
      );
    }

    // Fetch venue to get pricePerHour
    const venueRef = db.collection("venues").doc(String(venueId));
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    const venue = venueSnap.data() as any;

    // Fetch venueSlots to check availability and slot duration
    const venueSlots = await getVenueSlots(String(venueId));
    if (!venueSlots) {
      return NextResponse.json(
        { error: "Venue slots not initialized" },
        { status: 404 },
      );
    }

    const config = venueSlots.config;
    const slotDuration = config?.slotDuration || 60;
    const slotsCount = Number(slots || 1);

    // Check if desired slot(s) are available (not booked/held/blocked/reserved)
    const conflicts: string[] = [];

    // helper to check a single slot
    const checkSingle = (checkDate: string, checkStart: string) => {
      // Check blocked
      if (
        (venueSlots.blocked || []).some(
          (b) => b.date === checkDate && b.startTime === checkStart,
        )
      ) {
        conflicts.push("blocked");
        return;
      }
      // Check bookings
      if (
        (venueSlots.bookings || []).some(
          (b) => b.date === checkDate && b.startTime === checkStart,
        )
      ) {
        conflicts.push("booked");
        return;
      }
      // Check held (ensure not expired)
      const heldSlot = (venueSlots.held || []).find(
        (h) => h.date === checkDate && h.startTime === checkStart,
      );
      if (heldSlot) {
        const now = new Date();
        const expiresAt = heldSlot.holdExpiresAt?.toDate
          ? heldSlot.holdExpiresAt.toDate()
          : heldSlot.holdExpiresAt
            ? new Date(heldSlot.holdExpiresAt)
            : null;
        if (!expiresAt || expiresAt > now) {
          conflicts.push("held");
          return;
        }
      }
      // Check reserved
      if (
        (venueSlots.reserved || []).some(
          (r) => r.date === checkDate && r.startTime === checkStart,
        )
      ) {
        conflicts.push("reserved");
        return;
      }
    };

    // Generate consecutive start times based on slotDuration
    const [hourStr, minStr] = startTime.split(":");
    let currentMinutes = Number(hourStr) * 60 + Number(minStr);
    for (let i = 0; i < slotsCount; i++) {
      const h = Math.floor(currentMinutes / 60)
        .toString()
        .padStart(2, "0");
      const m = (currentMinutes % 60).toString().padStart(2, "0");
      const sTime = `${h}:${m}`;
      checkSingle(date, sTime);
      currentMinutes += slotDuration;
    }

    const available = conflicts.length === 0;

    // Compute amounts using venue price and slotDuration
    const pricePerHour = Number(venue.pricePerHour || venue.price || 0);
    const computed = computeAmountsFromVenue(
      pricePerHour,
      slotDuration,
      slotsCount,
    );

    return NextResponse.json({
      success: true,
      available,
      conflicts,
      computed,
      slotDuration,
      slotsCount,
    });
  } catch (error) {
    console.error("Error computing amount:", error);
    return NextResponse.json(
      { error: "Failed to compute amount" },
      { status: 500 },
    );
  }
}
