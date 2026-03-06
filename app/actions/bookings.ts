"use server";

import { db, auth } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { verifyUser, verifyManager } from "@/lib/server/auth";
import verifyTransaction from '@/lib/esewa/verify';
import { ESEWA_MERCHANT_CODE } from '@/lib/esewa/config';
import { logPayment } from '@/lib/paymentLogger';
import { bookSlot } from '@/lib/slotService.admin';
import { getVenueSlots } from '@/lib/slotService';
import { computeAmountsFromVenue, DEFAULT_ADVANCE_PERCENT } from '@/lib/pricing';
import { DEFAULT_CANCELLATION_HOURS, HOLD_DURATION_MS, generateBookingId, COLLECTIONS } from '@/lib/utils';

export async function createBooking(
  token: string,
  venueId: string,
  date: string,
  startTime: string,
  endTime: string,
) {
  try {
    const userId = await verifyUser(token);
    const bookingId = generateBookingId("booking");

    // 1. Compute authoritative amount (server-side) using venue config
    const venueRefForPrice = db.collection(COLLECTIONS.VENUES).doc(venueId);
    const venueSnapForPrice = await venueRefForPrice.get();
    if (!venueSnapForPrice.exists) {
      throw new Error('Venue not found for pricing');
    }
    const venueForPrice = venueSnapForPrice.data() as any;

    const venueSlotsForPrice = await getVenueSlots(venueId);
    if (!venueSlotsForPrice || !venueSlotsForPrice.config) {
      throw new Error('Venue slot configuration not initialized');
    }

    const slotDuration = venueSlotsForPrice.config.slotDuration || 60;
    const pricePerHour = Number(venueForPrice?.pricePerHour ?? venueForPrice?.price ?? 0);
    if (!pricePerHour || pricePerHour <= 0) {
      throw new Error('Invalid venue pricing configuration');
    }

    const advancePercent = typeof venueForPrice?.advancePercentage === 'number'
      ? venueForPrice.advancePercentage
      : typeof venueForPrice?.commissionPercentage === 'number'
        ? venueForPrice.commissionPercentage
        : DEFAULT_ADVANCE_PERCENT;
    const computed = computeAmountsFromVenue(pricePerHour, slotDuration, 1, advancePercent);
    if (!computed || typeof computed.totalAmount !== 'number' || computed.totalAmount <= 0) {
      throw new Error('Failed to compute booking amount');
    }
    const amountToUse = computed.totalAmount;

    // 2. Check availability and Hold Slot (Transaction)
    const venueRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    
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
      
      // Check for existing hold; do not renew/extend unexpired holds
      const existingHold = data.held?.find(
        (s: any) => s.date === date && s.startTime === startTime
      );

      if (existingHold) {
        const now = Timestamp.now();
        if (existingHold.holdExpiresAt && existingHold.holdExpiresAt.toMillis() > now.toMillis()) {
          throw new Error("Slot is currently held");
        }
      }

      // Remove any expired hold for this slot
      const held = (data.held || []).filter(
        (s: any) => !(s.date === date && s.startTime === startTime)
      );
      
      // Add new hold
      const now = Timestamp.now();
      const holdExpiresAt = Timestamp.fromMillis(now.toMillis() + HOLD_DURATION_MS);
      
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
    const amount = amountToUse;
    const advanceAmount = computed.advanceAmount;
    const dueAmount = computed.totalAmount - computed.advanceAmount;

    const bookingData = {
      venueId,
      userId,
      date,
      startTime,
      endTime,
      status: "pending_payment",
      bookingType: "website",
      holdExpiresAt: Timestamp.fromMillis(Date.now() + HOLD_DURATION_MS),
      createdAt: FieldValue.serverTimestamp(),
      amount,
      advanceAmount,
      dueAmount,
      paymentStatus: "pending", // pending, partial, full
    };
    
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
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
    
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
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
      
      if (diffHours < DEFAULT_CANCELLATION_HOURS) {
        throw new Error(`Cannot cancel within ${DEFAULT_CANCELLATION_HOURS} hours of booking time`);
      }
    }
    
    // Update booking status
    await bookingRef.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
    });
    
    // Release slot if it was confirmed or held
    if (booking.venueId && booking.date && booking.startTime) {
      const venueRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(booking.venueId);
      
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

export async function releaseHold(token: string, bookingId: string) {
  try {
    const userId = await verifyUser(token);

    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      throw new Error("Booking not found");
    }

    const booking = bookingDoc.data();
    if (booking?.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Only allow releasing hold for pending payments
    if (booking.status !== "pending_payment") {
      throw new Error("Booking is not a pending payment hold");
    }

    // Update booking status to cancelled and record timestamp
    await bookingRef.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    // Release the hold from venueSlots
    if (booking.venueId && booking.date && booking.startTime) {
      const venueRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(booking.venueId);

      await db.runTransaction(async (t) => {
        const docSnap = await t.get(venueRef);
        if (!docSnap.exists) return;

        const data = docSnap.data() as any;
        const held = (data.held || []).filter(
          (s: any) => !(s.date === booking.date && s.startTime === booking.startTime)
        );

        t.update(venueRef, {
          held,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }

    revalidatePath("/user/bookings");
    return { success: true };
  } catch (error: any) {
    console.error("Error releasing hold:", error);
    return { success: false, error: error.message || "Failed to release hold" };
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
    const bookingId = generateBookingId("physical");
    
    // 1. Book Slot in VenueSlots (Transaction)
    const venueRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    
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
      paymentStatus: "full", // Physical bookings are usually paid or handled on spot
    };
    
    await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).set(bookingData);
    
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
    
    const venueRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    
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

export async function expireBooking(token: string, bookingId: string, options?: { force?: boolean }) {
  try {
    const userId = await verifyUser(token);
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
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

    // Check if truly expired (unless forced)
    const now = Timestamp.now();
    if (!options?.force && bookingData.holdExpiresAt && bookingData.holdExpiresAt.toMillis() > now.toMillis()) {
      return { success: false, error: "Hold has not expired yet" };
    }

    // If a payment attempt was initiated, try verifying with eSewa first.
    const txn = bookingData.esewaTransactionUuid || bookingData.esewaTransactionId || null;
    if (txn) {
      try {
        // Prefer advanceAmount or esewaAmount for verification if available
        const verifyAmount = bookingData.esewaAmount || bookingData.advanceAmount || bookingData.amount;
        const verification = await verifyTransaction(txn, ESEWA_MERCHANT_CODE, verifyAmount);

        if (verification.verified) {
          // Payment complete — convert hold to confirmed booking (or completed if time passed)
          try {
            await bookSlot(bookingData.venueId, bookingData.date, bookingData.startTime, {
              bookingId: bookingRef.id,
              bookingType: 'website',
              status: 'confirmed',
              userId: bookingData.userId,
            });

            // Determine if booking should be marked completed (end time passed)
            let newStatus: string = 'confirmed';
            if (bookingData.date && bookingData.endTime) {
              try {
                const endDt = new Date(`${bookingData.date}T${bookingData.endTime}`);
                if (endDt.getTime() <= Date.now()) {
                  newStatus = 'completed';
                }
              } catch (e) {
                // ignore parse errors — default to confirmed
              }
            }

            await bookingRef.update({
              status: newStatus,
              paymentTimestamp: FieldValue.serverTimestamp(),
              esewaTransactionCode: verification.refId || bookingData.esewaTransactionCode || null,
              esewaTransactionUuid: txn,
              esewaStatus: verification.status,
              esewaAmount: verification.totalAmount || verifyAmount,
              verifiedAt: FieldValue.serverTimestamp(),
            });

            // Log payment
            try {
              await logPayment({
                transactionUuid: txn,
                bookingId: bookingRef.id,
                userId: bookingData.userId || '',
                venueId: bookingData.venueId || '',
                amount: Number(verification.totalAmount || verifyAmount || 0),
                status: 'success',
                method: 'esewa',
                productCode: verification.productCode,
                refId: verification.refId,
                metadata: { source: 'expireBooking:verification' },
              });
            } catch (logErr) {
              console.warn('Failed to log payment after verification:', logErr);
            }

            revalidatePath(`/venue/${bookingData.venueId}`);
            return { success: true, verified: true, bookingConfirmed: true };
          } catch (confirmErr) {
            console.error('Error confirming booking after verification:', confirmErr);
            // If confirmation failed, still return verified true so that
            // the caller knows payment succeeded; admin/manual reconciliation may follow.
            return { success: true, verified: true, bookingConfirmed: false, error: String(confirmErr) };
          }
        }

        // If not verified, fallthrough to expiry below. We DO NOT extend holds here.
      } catch (verifyErr) {
        console.warn('Error verifying eSewa transaction during expire flow (will proceed to expire):', verifyErr);
        // Do not defer or extend the hold on verification errors — expire the booking.
      }
    }

    // Default behaviour: expire booking and release hold
    await bookingRef.update({
      status: 'expired',
      expiredAt: FieldValue.serverTimestamp(),
    });

    // Also release the hold
    const venueRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(bookingData.venueId);
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
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
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
      const venueRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(booking.venueId);
      
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

export async function markBookingAsPaid(
  token: string,
  bookingId: string,
  paymentMethod: "cash" | "online"
) {
  try {
    const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return { success: false, error: "Booking not found" };
    }

    const booking = bookingDoc.data();
    if (!booking?.venueId) {
      return { success: false, error: "Invalid booking data" };
    }

    // Get manager UID first, then verify authorization
    const managerId = await verifyUser(token);
    const isManager = await verifyManager(token, booking.venueId);
    if (!isManager) {
      return { success: false, error: "Unauthorized" };
    }

    const paidAmount = booking.dueAmount || 0;

    // Update booking payment status
    await bookingRef.update({
      paymentStatus: "full",
      duePaymentMethod: paymentMethod,
      duePaidAt: FieldValue.serverTimestamp(),
      dueAmount: 0, // Clear due amount as it's paid
    });

    // Log due payment record (non-fatal — don't fail the operation if this errors)
    try {
      const [venueSnap, userSnap] = await Promise.all([
        db.collection(COLLECTIONS.VENUES).doc(booking.venueId).get(),
        booking.userId
          ? db.collection(COLLECTIONS.USERS).doc(booking.userId).get()
          : Promise.resolve(null),
      ]);
      const venueName = venueSnap.exists ? (venueSnap.data() as any)?.name || "" : "";
      const userData = userSnap?.exists ? (userSnap.data() as any) : null;
      const userEmail = userData?.email || "";
      const userName =
        userData?.displayName || userData?.name || booking.customerName || "";

      await db.collection(COLLECTIONS.DUE_PAYMENTS).add({
        bookingId,
        venueId: booking.venueId,
        venueName,
        userId: booking.userId || null,
        userName,
        userEmail,
        managerId,
        amount: paidAmount,
        paymentMethod,
        bookingDate: booking.date || "",
        bookingStartTime: booking.startTime || "",
        bookingEndTime: booking.endTime || "",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (logErr) {
      console.error("Failed to log due payment record (non-fatal):", logErr);
    }

    revalidatePath("/manager/bookings");
    revalidatePath("/manager/payments");
    return { success: true };
  } catch (error: any) {
    console.error("Error marking booking as paid:", error);
    return { success: false, error: error.message || "Failed to mark as paid" };
  }
}
