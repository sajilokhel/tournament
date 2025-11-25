"use server";

import { db, auth } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { verifyUser, verifyManager } from "@/lib/server/auth";

export async function createBooking(
  token: string,
  venueId: string,
  date: string,
  startTime: string,
  endTime: string,
  amount: number
) {
  try {
    const userId = await verifyUser(token);
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. Check availability and Hold Slot (Transaction)
    const venueRef = db.collection("venueSlots").doc(venueId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(venueRef);
      if (!doc.exists) throw new Error("Venue not found");
      
      const data = doc.data() as any;
      
      // Check blocked
      const isBlocked = data.blocked?.some(
        (s: any) => s.date === date && s.startTime === startTime
      );
      if (isBlocked) throw new Error("Slot is blocked");
      
      // Check booked
      const isBooked = data.bookings?.some(
        (s: any) => s.date === date && s.startTime === startTime
      );
      if (isBooked) throw new Error("Slot is already booked");
      
      // Check held by others
      const existingHold = data.held?.find(
        (s: any) => s.date === date && s.startTime === startTime
      );
      
      if (existingHold && existingHold.userId !== userId) {
        const now = Timestamp.now();
        if (existingHold.holdExpiresAt.toMillis() > now.toMillis()) {
          throw new Error("Slot is held by another user");
        }
      }
      
      // Remove existing hold for this slot
      const held = (data.held || []).filter(
        (s: any) => !(s.date === date && s.startTime === startTime)
      );
      
      // Add new hold
      const now = Timestamp.now();
      const holdExpiresAt = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000); // 5 mins
      
      const heldSlot = {
        date,
        startTime,
        userId,
        bookingId,
        holdExpiresAt,
        createdAt: now,
      };
      
      t.update(venueRef, {
        held: [...held, heldSlot],
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    // 2. Create Booking Document
    const bookingData = {
      venueId,
      userId,
      date,
      startTime,
      endTime,
      status: "pending_payment",
      bookingType: "website",
      holdExpiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
      createdAt: FieldValue.serverTimestamp(),
      amount,
    };
    
    const bookingRef = db.collection("bookings").doc(bookingId);
    await bookingRef.set(bookingData);
    
    revalidatePath(`/venue/${venueId}`);
    return { success: true, bookingId };
    
  } catch (error: any) {
    console.error("Error creating booking:", error);
    return { success: false, error: error.message || "Failed to create booking" };
  }
}

export async function cancelBooking(token: string, bookingId: string) {
  try {
    const userId = await verifyUser(token);
    
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();
    
    if (!bookingDoc.exists) {
      throw new Error("Booking not found");
    }
    
    const booking = bookingDoc.data();
    if (booking?.userId !== userId) {
      throw new Error("Unauthorized");
    }
    
    // Check cancellation policy (e.g. 5 hours before)
    if (booking.date && booking.startTime) {
      const now = new Date();
      const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`);
      const diffMs = bookingDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours < 5) {
        throw new Error("Cannot cancel within 5 hours of booking time");
      }
    }
    
    // Update booking status
    await bookingRef.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
    });
    
    // Release slot if it was confirmed or held
    if (booking.venueId && booking.date && booking.startTime) {
      const venueRef = db.collection("venueSlots").doc(booking.venueId);
      
      await db.runTransaction(async (t) => {
        const doc = await t.get(venueRef);
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
        
        t.update(venueRef, {
          bookings,
          held,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }
    
    revalidatePath("/user/bookings");
    return { success: true };
    
  } catch (error: any) {
    console.error("Error cancelling booking:", error);
    return { success: false, error: error.message || "Failed to cancel booking" };
  }
}

export async function createPhysicalBooking(
  token: string,
  venueId: string,
  date: string,
  startTime: string,
  endTime: string,
  customerName: string,
  customerPhone: string,
  notes: string
) {
  try {
    const isManager = await verifyManager(token, venueId);
    if (!isManager) throw new Error("Unauthorized");
    
    const userId = await verifyUser(token); // Manager's ID
    const bookingId = `physical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. Book Slot in VenueSlots (Transaction)
    const venueRef = db.collection("venueSlots").doc(venueId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(venueRef);
      if (!doc.exists) throw new Error("Venue not found");
      
      const data = doc.data() as any;
      
      // Check blocked/booked
      const isBlocked = data.blocked?.some(
        (s: any) => s.date === date && s.startTime === startTime
      );
      if (isBlocked) throw new Error("Slot is blocked");
      
      const isBooked = data.bookings?.some(
        (s: any) => s.date === date && s.startTime === startTime
      );
      if (isBooked) throw new Error("Slot is already booked");
      
      // Remove held if exists
      const held = (data.held || []).filter(
        (s: any) => !(s.date === date && s.startTime === startTime)
      );
      
      const bookedSlot = {
        date,
        startTime,
        bookingId,
        bookingType: "physical",
        status: "confirmed",
        customerName,
        customerPhone,
        notes,
        userId,
        createdAt: Timestamp.now(),
      };
      
      t.update(venueRef, {
        bookings: FieldValue.arrayUnion(bookedSlot),
        held,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    // 2. Create Booking Document
    const bookingData = {
      venueId,
      userId,
      date,
      startTime,
      endTime,
      bookingType: "physical",
      status: "confirmed",
      customerName,
      customerPhone,
      notes,
      createdAt: FieldValue.serverTimestamp(),
      amount: 0,
    };
    
    await db.collection("bookings").add(bookingData);
    
    revalidatePath(`/venue/${venueId}`);
    return { success: true };
    
  } catch (error: any) {
    console.error("Error creating physical booking:", error);
    return { success: false, error: error.message || "Failed to create booking" };
  }
}

export async function unbookBooking(
  token: string,
  venueId: string,
  date: string,
  startTime: string
) {
  try {
    const isManager = await verifyManager(token, venueId);
    if (!isManager) throw new Error("Unauthorized");
    
    const venueRef = db.collection("venueSlots").doc(venueId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(venueRef);
      if (!doc.exists) return;
      
      const data = doc.data() as any;
      const bookings = (data.bookings || []).filter(
        (s: any) => !(s.date === date && s.startTime === startTime)
      );
      
      t.update(venueRef, {
        bookings,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    revalidatePath(`/venue/${venueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error unbooking slot:", error);
    return { success: false, error: error.message || "Failed to unbook slot" };
  }
}

export async function expireBooking(token: string, bookingId: string) {
  try {
    const userId = await verifyUser(token);
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return { success: false, error: "Booking not found" };
    }

    const bookingData = bookingDoc.data();
    if (bookingData?.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    if (bookingData.status !== "pending_payment") {
      return { success: false, error: "Booking is not pending" };
    }

    // Check if truly expired
    const now = Timestamp.now();
    if (bookingData.holdExpiresAt && bookingData.holdExpiresAt.toMillis() > now.toMillis()) {
      return { success: false, error: "Hold has not expired yet" };
    }

    await bookingRef.update({
      status: "expired",
      expiredAt: FieldValue.serverTimestamp(),
    });

    // Also release the hold
    const venueRef = db.collection("venueSlots").doc(bookingData.venueId);
    await db.runTransaction(async (t) => {
      const doc = await t.get(venueRef);
      if (!doc.exists) return;

      const data = doc.data() as any;
      const held = (data.held || []).filter(
        (s: any) => !(s.date === bookingData.date && s.startTime === bookingData.startTime)
      );

      t.update(venueRef, {
        held,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    revalidatePath(`/venue/${bookingData.venueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error expiring booking:", error);
    return { success: false, error: error.message || "Failed to expire booking" };
  }
}

export async function managerCancelBooking(token: string, bookingId: string) {
  try {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return { success: false, error: "Booking not found" };
    }

    const booking = bookingDoc.data();
    if (!booking?.venueId) {
      return { success: false, error: "Invalid booking data" };
    }

    // Verify manager
    const isManager = await verifyManager(token, booking.venueId);
    if (!isManager) {
      return { success: false, error: "Unauthorized" };
    }

    // Update booking status
    await bookingRef.update({
      status: "cancelled_by_manager",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    // Release slot from venueSlots
    if (booking.date && booking.startTime) {
      const venueRef = db.collection("venueSlots").doc(booking.venueId);
      
      await db.runTransaction(async (t) => {
        const doc = await t.get(venueRef);
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
        
        t.update(venueRef, {
          bookings,
          held,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }

    revalidatePath(`/venue/${booking.venueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error cancelling booking by manager:", error);
    return { success: false, error: error.message || "Failed to cancel booking" };
  }
}
