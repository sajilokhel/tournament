/**
 * Slot Service - Centralized slot management abstraction layer
 * 
 * This module provides a unified interface for all slot operations,
 * abstracting away the underlying Firestore data structure.
 * 
 * Architecture: One document per venue containing slot configuration
 * and only exceptions (blocked, booked, held, reserved).
 * Available slots are reconstructed from config + exceptions.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  runTransaction,
  Timestamp,
  DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ============================================================================
// Type Definitions
// ============================================================================

export interface SlotConfig {
  startTime: string;      // "06:00"
  endTime: string;        // "22:00"
  slotDuration: number;   // 60 (minutes)
  daysOfWeek: number[];   // [0,1,2,3,4,5,6] - 0=Sunday, 6=Saturday
  timezone?: string;      // "Asia/Kathmandu"
}

export interface BlockedSlot {
  date: string;           // "2025-11-20"
  startTime: string;      // "10:00"
  reason?: string;
  blockedBy?: string;     // managerId
  blockedAt: any;         // Timestamp
}

export interface BookedSlot {
  date: string;
  startTime: string;
  bookingId: string;
  bookingType: "physical" | "website";
  status: "confirmed" | "pending_payment";
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  userId?: string;
  createdAt: any;         // Timestamp
}

export interface HeldSlot {
  date: string;
  startTime: string;
  userId: string;
  bookingId: string;
  holdExpiresAt: any;     // Timestamp
  createdAt: any;         // Timestamp
}

export interface ReservedSlot {
  date: string;
  startTime: string;
  note?: string;
  reservedBy: string;     // managerId
  reservedAt: any;        // Timestamp
}

export interface VenueSlots {
  venueId: string;
  config: SlotConfig;
  blocked: BlockedSlot[];
  bookings: BookedSlot[];
  held: HeldSlot[];
  reserved: ReservedSlot[];
  updatedAt: any;         // Timestamp
}

export interface ReconstructedSlot {
  date: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BLOCKED" | "BOOKED" | "HELD" | "RESERVED";
  bookingType?: "physical" | "website";
  bookingId?: string;
  customerName?: string;
  customerPhone?: string;
  userId?: string;
  reason?: string;
  note?: string;
  holdExpiresAt?: any;
}

export interface BookingData {
  bookingId: string;
  bookingType: "physical" | "website";
  status: "confirmed" | "pending_payment";
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  userId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate time slots based on start/end time and duration
 */
function generateTimeSlots(startTime: string, endTime: string, duration: number): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes < endMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const min = currentMinutes % 60;
    slots.push(`${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
    currentMinutes += duration;
  }
  
  return slots;
}

/**
 * Get end time for a slot given start time and duration
 */
function getEndTime(startTime: string, duration: number): string {
  const [hour, min] = startTime.split(":").map(Number);
  const totalMinutes = hour * 60 + min + duration;
  const endHour = Math.floor(totalMinutes / 60);
  const endMin = totalMinutes % 60;
  return `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
}

/**
 * Check if a date is in the past
 */
function isPast(date: string, startTime: string): boolean {
  const slotDateTime = new Date(`${date}T${startTime}`);
  return slotDateTime < new Date();
}

/**
 * Match slot by date and startTime
 */
function matchSlot(date: string, startTime: string) {
  return (item: any) => item.date === date && item.startTime === startTime;
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Get venue slots document
 */
export async function getVenueSlots(venueId: string): Promise<VenueSlots | null> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return docSnap.data() as VenueSlots;
  } catch (error) {
    console.error("Error getting venue slots:", error);
    throw error;
  }
}

/**
 * Initialize venue slots document with default config
 */
export async function initializeVenueSlots(
  venueId: string,
  config: SlotConfig
): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    
    const venueSlots: VenueSlots = {
      venueId,
      config: {
        ...config,
        timezone: config.timezone || "Asia/Kathmandu",
      },
      blocked: [],
      bookings: [],
      held: [],
      reserved: [],
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(docRef, venueSlots);
  } catch (error) {
    console.error("Error initializing venue slots:", error);
    throw error;
  }
}

/**
 * Reconstruct slots from config and exceptions for a date range
 */
export async function reconstructSlots(
  venueId: string,
  startDate: Date,
  endDate: Date
): Promise<ReconstructedSlot[]> {
  try {
    const venueSlots = await getVenueSlots(venueId);
    
    if (!venueSlots) {
      return [];
    }
    
    const { config, blocked, bookings, held, reserved } = venueSlots;
    const slots: ReconstructedSlot[] = [];
    
    // Generate all possible slots for the date range
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Check if this day is enabled
      if (config.daysOfWeek.includes(dayOfWeek)) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        const timeSlots = generateTimeSlots(
          config.startTime,
          config.endTime,
          config.slotDuration
        );
        
        for (const startTime of timeSlots) {
          // Skip past slots
          if (isPast(dateString, startTime)) {
            continue;
          }
          
          const endTime = getEndTime(startTime, config.slotDuration);
          
          // Check if blocked
          const blockedSlot = blocked.find(matchSlot(dateString, startTime));
          if (blockedSlot) {
            slots.push({
              date: dateString,
              startTime,
              endTime,
              status: "BLOCKED",
              reason: blockedSlot.reason,
            });
            continue;
          }
          
          // Check if booked
          const bookedSlot = bookings.find(matchSlot(dateString, startTime));
          if (bookedSlot) {
            slots.push({
              date: dateString,
              startTime,
              endTime,
              status: "BOOKED",
              bookingType: bookedSlot.bookingType,
              bookingId: bookedSlot.bookingId,
              customerName: bookedSlot.customerName,
              customerPhone: bookedSlot.customerPhone,
              userId: bookedSlot.userId,
            });
            continue;
          }
          
          // Check if held
          const heldSlot = held.find(matchSlot(dateString, startTime));
          if (heldSlot) {
            // Check if hold has expired
            const now = Timestamp.now();
            const expiresAt = heldSlot.holdExpiresAt;
            
            if (expiresAt && expiresAt.toMillis() > now.toMillis()) {
              slots.push({
                date: dateString,
                startTime,
                endTime,
                status: "HELD",
                userId: heldSlot.userId,
                bookingId: heldSlot.bookingId,
                holdExpiresAt: heldSlot.holdExpiresAt,
              });
              continue;
            }
            // If expired, treat as available (cleanup will happen async)
          }
          
          // Check if reserved
          const reservedSlot = reserved.find(matchSlot(dateString, startTime));
          if (reservedSlot) {
            slots.push({
              date: dateString,
              startTime,
              endTime,
              status: "RESERVED",
              note: reservedSlot.note,
            });
            continue;
          }
          
          // Default: Available
          slots.push({
            date: dateString,
            startTime,
            endTime,
            status: "AVAILABLE",
          });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return slots;
  } catch (error) {
    console.error("Error reconstructing slots:", error);
    throw error;
  }
}

/**
 * Block a slot
 */
export async function blockSlot(
  venueId: string,
  date: string,
  startTime: string,
  reason?: string,
  blockedBy?: string
): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    
    const blockedSlot: BlockedSlot = {
      date,
      startTime,
      blockedAt: Timestamp.now(),
    };

    if (reason) blockedSlot.reason = reason;
    if (blockedBy) blockedSlot.blockedBy = blockedBy;
    
    await updateDoc(docRef, {
      blocked: arrayUnion(blockedSlot),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error blocking slot:", error);
    throw error;
  }
}

/**
 * Unblock a slot
 */
export async function unblockSlot(
  venueId: string,
  date: string,
  startTime: string
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      
      if (!docSnap.exists()) {
        throw new Error("Venue slots not found");
      }
      
      const data = docSnap.data() as VenueSlots;
      const blocked = data.blocked.filter(
        (slot) => !(slot.date === date && slot.startTime === startTime)
      );
      
      transaction.update(docRef, {
        blocked,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error unblocking slot:", error);
    throw error;
  }
}

/**
 * Book a slot (add to bookings array)
 */
export async function bookSlot(
  venueId: string,
  date: string,
  startTime: string,
  bookingData: BookingData
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      
      if (!docSnap.exists()) {
        throw new Error("Venue slots not found");
      }
      
      const data = docSnap.data() as VenueSlots;
      
      // Check if slot is already booked
      const alreadyBooked = data.bookings.some(matchSlot(date, startTime));
      if (alreadyBooked) {
        throw new Error("Slot is already booked");
      }
      
      // Remove from held if exists
      const held = data.held.filter(
        (slot) => !(slot.date === date && slot.startTime === startTime)
      );
      
      // Only include defined fields (Firestore arrayUnion doesn't accept undefined)
      const bookedSlot: BookedSlot = {
        date,
        startTime,
        bookingId: bookingData.bookingId,
        bookingType: bookingData.bookingType,
        status: bookingData.status,
        createdAt: Timestamp.now(),
      };
      
      // Add optional fields only if they are defined
      if (bookingData.customerName !== undefined) bookedSlot.customerName = bookingData.customerName;
      if (bookingData.customerPhone !== undefined) bookedSlot.customerPhone = bookingData.customerPhone;
      if (bookingData.notes !== undefined) bookedSlot.notes = bookingData.notes;
      if (bookingData.userId !== undefined) bookedSlot.userId = bookingData.userId;
      
      transaction.update(docRef, {
        bookings: arrayUnion(bookedSlot),
        held,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error booking slot:", error);
    throw error;
  }
}

/**
 * Unbook a slot (remove from bookings array)
 */
export async function unbookSlot(
  venueId: string,
  date: string,
  startTime: string
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      
      if (!docSnap.exists()) {
        throw new Error("Venue slots not found");
      }
      
      const data = docSnap.data() as VenueSlots;
      const bookings = data.bookings.filter(
        (slot) => !(slot.date === date && slot.startTime === startTime)
      );
      
      transaction.update(docRef, {
        bookings,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error unbooking slot:", error);
    throw error;
  }
}

/**
 * Hold a slot temporarily (5 minutes)
 */
export async function holdSlot(
  venueId: string,
  date: string,
  startTime: string,
  userId: string,
  bookingId: string,
  holdDurationMinutes: number = 5
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      
      if (!docSnap.exists()) {
        throw new Error("Venue slots not found");
      }
      
      const data = docSnap.data() as VenueSlots;
      
      // Check if slot is already booked
      const alreadyBooked = data.bookings.some(matchSlot(date, startTime));
      if (alreadyBooked) {
        throw new Error("Slot is already booked");
      }
      
      // Check if slot is already held by someone else
      const existingHold = data.held.find(matchSlot(date, startTime));
      if (existingHold && existingHold.userId !== userId) {
        const now = Timestamp.now();
        if (existingHold.holdExpiresAt.toMillis() > now.toMillis()) {
          throw new Error("Slot is currently held by another user");
        }
      }
      
      // Remove existing hold for this slot if any
      const held = data.held.filter(
        (slot) => !(slot.date === date && slot.startTime === startTime)
      );
      
      const now = Timestamp.now();
      const holdExpiresAt = new Timestamp(
        now.seconds + holdDurationMinutes * 60,
        now.nanoseconds
      );
      
      const heldSlot: HeldSlot = {
        date,
        startTime,
        userId,
        bookingId,
        holdExpiresAt,
        createdAt: Timestamp.now(),
      };
      
      transaction.update(docRef, {
        held: [...held, heldSlot],
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error holding slot:", error);
    throw error;
  }
}

/**
 * Release a hold on a slot
 */
export async function releaseHold(
  venueId: string,
  date: string,
  startTime: string
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      
      if (!docSnap.exists()) {
        throw new Error("Venue slots not found");
      }
      
      const data = docSnap.data() as VenueSlots;
      const held = data.held.filter(
        (slot) => !(slot.date === date && slot.startTime === startTime)
      );
      
      transaction.update(docRef, {
        held,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error releasing hold:", error);
    throw error;
  }
}

/**
 * Clean up expired holds
 */
export async function cleanExpiredHolds(venueId: string): Promise<number> {
  try {
    let removedCount = 0;
    
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      
      if (!docSnap.exists()) {
        return;
      }
      
      const data = docSnap.data() as VenueSlots;
      const now = Timestamp.now();
      
      const held = data.held.filter((slot) => {
        const isExpired = slot.holdExpiresAt.toMillis() <= now.toMillis();
        if (isExpired) removedCount++;
        return !isExpired;
      });
      
      if (removedCount > 0) {
        transaction.update(docRef, {
          held,
          updatedAt: serverTimestamp(),
        });
      }
    });
    
    return removedCount;
  } catch (error) {
    console.error("Error cleaning expired holds:", error);
    throw error;
  }
}

/**
 * Reserve a slot (manager reservation without booking)
 */
export async function reserveSlot(
  venueId: string,
  date: string,
  startTime: string,
  reservedBy: string,
  note?: string
): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    
    const reservedSlot: ReservedSlot = {
      date,
      startTime,
      note,
      reservedBy,
      reservedAt: Timestamp.now(),
    };
    
    await updateDoc(docRef, {
      reserved: arrayUnion(reservedSlot),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error reserving slot:", error);
    throw error;
  }
}

/**
 * Unreserve a slot
 */
export async function unreserveSlot(
  venueId: string,
  date: string,
  startTime: string
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      
      if (!docSnap.exists()) {
        throw new Error("Venue slots not found");
      }
      
      const data = docSnap.data() as VenueSlots;
      const reserved = data.reserved.filter(
        (slot) => !(slot.date === date && slot.startTime === startTime)
      );
      
      transaction.update(docRef, {
        reserved,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error unreserving slot:", error);
    throw error;
  }
}

/**
 * Update slot configuration
 */
export async function updateSlotConfig(
  venueId: string,
  config: Partial<SlotConfig>
): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    
    await updateDoc(docRef, {
      config: config,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating slot config:", error);
    throw error;
  }
}

/**
 * Get slot status for a specific date/time
 */
export async function getSlotStatus(
  venueId: string,
  date: string,
  startTime: string
): Promise<ReconstructedSlot | null> {
  try {
    const startDate = new Date(date);
    const endDate = new Date(date);
    
    const slots = await reconstructSlots(venueId, startDate, endDate);
    
    return slots.find((slot) => slot.date === date && slot.startTime === startTime) || null;
  } catch (error) {
    console.error("Error getting slot status:", error);
    throw error;
  }
}
