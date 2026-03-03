/**
 * Write-capable slot service (client SDK version)
 * NOTE: Prefer server-side `lib/slotService.admin.ts` for privileged operations.
 * This module mirrors write helpers where needed for server-side non-admin usage
 * or for migration; avoid importing this from client components.
 */
import {
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  runTransaction,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  SlotConfig,
  BlockedSlot,
  BookedSlot,
  HeldSlot,
  ReservedSlot,
  VenueSlots,
  BookingData,
} from "@/lib/slotService.read";
import { DEFAULT_TIMEZONE } from "@/lib/utils";

export async function initializeVenueSlots(venueId: string, config: SlotConfig): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    const venueSlots: VenueSlots = {
      venueId,
      config: {
        ...config,
        timezone: config.timezone || DEFAULT_TIMEZONE,
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

export async function blockSlot(venueId: string, date: string, startTime: string, reason?: string, blockedBy?: string): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    const blockedSlot: BlockedSlot = { date, startTime, blockedAt: Timestamp.now() };
    if (reason) blockedSlot.reason = reason;
    if (blockedBy) blockedSlot.blockedBy = blockedBy;
    await updateDoc(docRef, { blocked: arrayUnion(blockedSlot), updatedAt: serverTimestamp() });
  } catch (error) {
    console.error("Error blocking slot:", error);
    throw error;
  }
}

export async function unblockSlot(venueId: string, date: string, startTime: string): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("Venue slots not found");
      const data = docSnap.data() as VenueSlots;
      const blocked = data.blocked.filter((slot) => !(slot.date === date && slot.startTime === startTime));
      transaction.update(docRef, { blocked, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    console.error("Error unblocking slot:", error);
    throw error;
  }
}

export async function bookSlot(venueId: string, date: string, startTime: string, bookingData: BookingData): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("Venue slots not found");
      const data = docSnap.data() as VenueSlots;
      const alreadyBooked = data.bookings.some((item) => item.date === date && item.startTime === startTime);
      if (alreadyBooked) throw new Error("Slot is already booked");
      const held = data.held.filter((slot) => !(slot.date === date && slot.startTime === startTime));

      const bookedSlot: BookedSlot = {
        date,
        startTime,
        bookingId: bookingData.bookingId,
        bookingType: bookingData.bookingType,
        status: bookingData.status,
        createdAt: Timestamp.now(),
      } as BookedSlot;
      if (bookingData.customerName !== undefined) bookedSlot.customerName = bookingData.customerName;
      if (bookingData.customerPhone !== undefined) bookedSlot.customerPhone = bookingData.customerPhone;
      if (bookingData.notes !== undefined) bookedSlot.notes = bookingData.notes;
      if (bookingData.userId !== undefined) bookedSlot.userId = bookingData.userId;

      transaction.update(docRef, { bookings: arrayUnion(bookedSlot), held, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    console.error("Error booking slot:", error);
    throw error;
  }
}

export async function unbookSlot(venueId: string, date: string, startTime: string): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("Venue slots not found");
      const data = docSnap.data() as VenueSlots;
      const bookings = data.bookings.filter((slot) => !(slot.date === date && slot.startTime === startTime));
      transaction.update(docRef, { bookings, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    console.error("Error unbooking slot:", error);
    throw error;
  }
}

export async function holdSlot(venueId: string, date: string, startTime: string, userId: string, bookingId: string, holdDurationMinutes: number = 5): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("Venue slots not found");
      const data = docSnap.data() as VenueSlots;
      const alreadyBooked = data.bookings.some((item) => item.date === date && item.startTime === startTime);
      if (alreadyBooked) throw new Error("Slot is already booked");
      const existingHold = data.held.find((s) => s.date === date && s.startTime === startTime);
      // Do not allow renewing an existing unexpired hold (prevents extending)
      if (existingHold) {
        const now = Timestamp.now();
        if (existingHold.holdExpiresAt && existingHold.holdExpiresAt.toMillis() > now.toMillis()) {
          throw new Error("Slot is currently held");
        }
      }

      const held = data.held.filter((slot) => !(slot.date === date && slot.startTime === startTime));
      const now = Timestamp.now();
      const holdExpiresAt = new Timestamp(now.seconds + holdDurationMinutes * 60, now.nanoseconds);

      const heldSlot: HeldSlot = { date, startTime, userId, bookingId, holdExpiresAt, createdAt: Timestamp.now() };

      transaction.update(docRef, { held: [...held, heldSlot], updatedAt: serverTimestamp() });
    });
  } catch (error) {
    console.error("Error holding slot:", error);
    throw error;
  }
}

export async function releaseHold(venueId: string, date: string, startTime: string): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("Venue slots not found");
      const data = docSnap.data() as VenueSlots;
      const held = data.held.filter((slot) => !(slot.date === date && slot.startTime === startTime));
      transaction.update(docRef, { held, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    console.error("Error releasing hold:", error);
    throw error;
  }
}

export async function cleanExpiredHolds(venueId: string): Promise<number> {
  try {
    let removedCount = 0;
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) return;
      const data = docSnap.data() as VenueSlots;
      const now = Timestamp.now();
      const held = data.held.filter((slot) => {
        const isExpired = slot.holdExpiresAt.toMillis() <= now.toMillis();
        if (isExpired) removedCount++;
        return !isExpired;
      });
      if (removedCount > 0) transaction.update(docRef, { held, updatedAt: serverTimestamp() });
    });
    return removedCount;
  } catch (error) {
    console.error("Error cleaning expired holds:", error);
    throw error;
  }
}

export async function reserveSlot(venueId: string, date: string, startTime: string, reservedBy: string, note?: string): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    const reservedSlot: ReservedSlot = { date, startTime, note, reservedBy, reservedAt: Timestamp.now() };
    await updateDoc(docRef, { reserved: arrayUnion(reservedSlot), updatedAt: serverTimestamp() });
  } catch (error) {
    console.error("Error reserving slot:", error);
    throw error;
  }
}

export async function unreserveSlot(venueId: string, date: string, startTime: string): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, "venueSlots", venueId);
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) throw new Error("Venue slots not found");
      const data = docSnap.data() as VenueSlots;
      const reserved = data.reserved.filter((slot) => !(slot.date === date && slot.startTime === startTime));
      transaction.update(docRef, { reserved, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    console.error("Error unreserving slot:", error);
    throw error;
  }
}

export async function updateSlotConfig(venueId: string, config: Partial<SlotConfig>): Promise<void> {
  try {
    const docRef = doc(db, "venueSlots", venueId);
    await updateDoc(docRef, { config: config, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error("Error updating slot config:", error);
    throw error;
  }

}
