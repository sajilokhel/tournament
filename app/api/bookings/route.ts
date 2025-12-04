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

    const { venueId, date, startTime, endTime, amount } = body || {};

    // Basic validation
    if (
      !venueId ||
      !date ||
      !startTime ||
      amount === undefined ||
      amount === null
    ) {
      return NextResponse.json(
        { error: "Missing required fields: venueId, date, startTime, amount" },
        { status: 400 },
      );
    }

    // Call the existing server action. It will verify the token internally.
    const result = await createBooking(
      token,
      venueId,
      date,
      startTime,
      endTime,
      amount,
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
