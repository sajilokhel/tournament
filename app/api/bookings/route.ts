/*
 * POST /api/bookings
 *
 * Description:
 *   Creates a booking (server-side action wrapper). This route is a thin HTTP
 *   wrapper that forwards the request to the server action `createBooking`
 *   which performs token verification and transactional writes (hold -> booking).
 *
 * Authentication:
 *   - Required: Authorization header with Bearer <idToken>.
 *   - The server action `createBooking` validates the token and returns an
 *     appropriate error if token is invalid or missing.
 *
 * Request:
 *   - Method: POST
 *   - Headers:
 *       Authorization: Bearer <idToken>
 *       Content-Type: application/json
 *   - Body (JSON):
 *       {
 *         "venueId": string,      // required
 *         "date": string,         // required, e.g. "2025-12-31"
 *         "startTime": string,    // required, e.g. "18:00"
 *         "endTime": string,      // optional, e.g. "19:00"
 *         // The server computes amounts; clients should NOT trust client-side price.
 *       }
 *
 * Successful Responses:
 *   1) Booking created
 *      - Status: 201 Created
 *      - Body:
 *          { "success": true, "bookingId": "<newBookingId>" }
 *
 *   2) If the server action returns success along with details, this route
 *      forwards the result in the same success format above.
 *
 * Client / Validation Errors:
 *   - 400 Bad Request
 *     - Missing or invalid JSON body:
 *         { "error": "Invalid JSON body" }
 *     - Missing required fields:
 *         { "error": "Missing required fields: venueId, date, startTime" }
 *     - Server action returned a domain error (e.g. slot unavailable):
 *         { "success": false, "error": "<message from createBooking>" }
 *
 * Authentication Errors:
 *   - 401 Unauthorized
 *     - When Authorization header missing or not a Bearer token:
 *         { "error": "Missing Authorization token" }
 *     - The server action may also return 401 for invalid token.
 *
 * Server Errors:
 *   - 500 Internal Server Error
 *     - Unexpected/unhandled exceptions:
 *         { "error": "Internal server error" }
 *
 * Side effects:
 *   - The actual booking logic (hold, amount computation, writes) is performed
 *     inside `createBooking`. That function will:
 *       - Verify token and user identity
 *       - Compute amounts server-side (advance/due)
 *       - Create booking document with appropriate status (e.g. PENDING_PAYMENT)
 *       - Mirror the hold/booking into canonical venueSlots document
 *       - Return { success: true, bookingId } on success or { success: false, error } on failure
 *
 * Notes and examples:
 *   - Example request:
 *       POST /api/bookings
 *       Authorization: Bearer eyJ...
 *       Body:
 *         { "venueId": "v123", "date": "2025-12-31", "startTime": "18:00" }
 *
 *   - Example success response:
 *         { "success": true, "bookingId": "b_abc123" }
 *
 *   - Example failure (missing fields):
 *         Status: 400
 *         { "error": "Missing required fields: venueId, date, startTime" }
 *
 *   - Important: The route intentionally keeps business logic out of the HTTP
 *     wrapper and delegates to `createBooking`. Always prefer server-side
 *     computation for amounts and validations to prevent client manipulation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createBooking } from "@/app/actions/bookings";

/**
 * POST /api/bookings
 *
 * Thin API wrapper around server action `createBooking`.
 * - Expects Authorization: Bearer <idToken>
 * - Body: { venueId, date, startTime, endTime?, amount }
 *
 * The server action will verify the token and perform transactional
 * booking & hold writes.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization token" },
        { status: 401 },
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { venueId, date, startTime, endTime } = body || {};

    // Basic validation (server will compute amount)
    if (!venueId || !date || !startTime) {
      return NextResponse.json(
        { error: "Missing required fields: venueId, date, startTime" },
        { status: 400 },
      );
    }

    // Call the existing server action. It will verify the token internally and compute amount server-side.
    const result = await createBooking(
      token,
      venueId,
      date,
      startTime,
      endTime,
    );

    if (result?.success) {
      return NextResponse.json(
        { success: true, bookingId: result.bookingId },
        { status: 201 },
      );
    }

    // If the action returned an error message, forward it with 400.
    return NextResponse.json(
      { success: false, error: result?.error || "Failed to create booking" },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("Unhandled error in bookings API:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
