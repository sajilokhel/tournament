import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin"; // Use Admin SDK
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
        { status: 400 }
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
          (s: any) => !(s.date === booking.date && s.startTime === booking.startTime)
        );
        
        // Remove from held
        const held = (data.held || []).filter(
          (s: any) => !(s.date === booking.date && s.startTime === booking.startTime)
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
      { status: 500 }
    );
  }
}
