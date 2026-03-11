import { NextRequest, NextResponse } from "next/server";
import { createPhysicalBooking } from "@/app/actions/bookings";
import { extractBearerToken } from "@/lib/server/auth";

/**
 * POST /api/bookings/physical
 *
 * API wrapper around server action `createPhysicalBooking`.
 * Used by managers to create walk-in or manual bookings.
 * 
 * Expects Authorization: Bearer <idToken>
 * Body: { venueId, date, startTime, endTime, customerName, customerPhone, notes }
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization token" },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { 
      venueId, 
      date, 
      startTime, 
      endTime, 
      customerName, 
      customerPhone, 
      notes 
    } = body;

    if (!venueId || !date || !startTime || !endTime || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await createPhysicalBooking(
      token,
      venueId,
      date,
      startTime,
      endTime,
      customerName,
      customerPhone,
      notes || ""
    );

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error: any) {
    console.error("Error in POST /api/bookings/physical:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
