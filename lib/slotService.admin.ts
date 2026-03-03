import "server-only";
import admin from "firebase-admin";
import { isAdminInitialized, db as adminDb } from "@/lib/firebase-admin";
import { DEFAULT_TIMEZONE, generateBookingId, COLLECTIONS } from "@/lib/utils";

if (!isAdminInitialized()) {
  console.warn("Firebase Admin not initialized - slotService.admin will not work");
}

type BookingData = {
  bookingId: string;
  bookingType: "physical" | "website";
  status: "confirmed" | "pending_payment";
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  userId?: string;
};

/**
 * Convert a hold into a confirmed booking inside `venueSlots` using Admin SDK.
 * This mirrors the client-side `bookSlot` but runs with elevated privileges
 * and uses transactions against the server-side `venueSlots` document.
 */
export async function bookSlot(
  venueId: string,
  date: string,
  startTime: string,
  bookingData: BookingData
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");

  const db = adminDb as admin.firestore.Firestore;

  await db.runTransaction(async (tx) => {
    const docRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    const docSnap = await tx.get(docRef);

    if (!docSnap.exists) {
      throw new Error("Venue slots not found");
    }

    const data: any = docSnap.data();

    // Check if slot is already booked
    const alreadyBooked = (data.bookings || []).some((s: any) => s.date === date && s.startTime === startTime);
    if (alreadyBooked) {
      throw new Error("Slot is already booked");
    }

    // Remove from held if exists
    const held = (data.held || []).filter((slot: any) => !(slot.date === date && slot.startTime === startTime));

    const bookedSlot: any = {
      date,
      startTime,
      bookingId: bookingData.bookingId,
      bookingType: bookingData.bookingType,
      status: bookingData.status,
      createdAt: admin.firestore.Timestamp.now(),
    };

    if (bookingData.customerName !== undefined) bookedSlot.customerName = bookingData.customerName;
    if (bookingData.customerPhone !== undefined) bookedSlot.customerPhone = bookingData.customerPhone;
    if (bookingData.notes !== undefined) bookedSlot.notes = bookingData.notes;
    if (bookingData.userId !== undefined) bookedSlot.userId = bookingData.userId;

    tx.update(docRef, {
      bookings: admin.firestore.FieldValue.arrayUnion(bookedSlot),
      held,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export default { bookSlot };

/** Additional server-side slot operations ported from client `lib/slotService.ts` */

export async function initializeVenueSlots(
  venueId: string,
  config: any
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  const venueSlots = {
    venueId,
    config: {
      ...config,
      timezone: config.timezone || DEFAULT_TIMEZONE,
    },
    blocked: [],
    bookings: [],
    held: [],
    reserved: [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId).set(venueSlots);
}

export async function holdSlot(
  venueId: string,
  date: string,
  startTime: string,
  userId: string,
  bookingId: string,
  holdDurationMinutes: number = 5
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  await db.runTransaction(async (tx) => {
    const docRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    const docSnap = await tx.get(docRef);
    if (!docSnap.exists) throw new Error("Venue slots not found");

    const data: any = docSnap.data();

    // Check if already booked
    const alreadyBooked = (data.bookings || []).some((s: any) => s.date === date && s.startTime === startTime);
    if (alreadyBooked) throw new Error("Slot is already booked");

    // Check existing hold
    const existingHold = (data.held || []).find((s: any) => s.date === date && s.startTime === startTime);
    // Do not allow renewing an existing unexpired hold (prevents extending)
    if (existingHold) {
      const now = admin.firestore.Timestamp.now();
      if (existingHold.holdExpiresAt && existingHold.holdExpiresAt.toMillis() > now.toMillis()) {
        throw new Error("Slot is currently held");
      }
    }

    const held = (data.held || []).filter((s: any) => !(s.date === date && s.startTime === startTime));

    const now = admin.firestore.Timestamp.now();
    const holdExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + holdDurationMinutes * 60 * 1000);

    const heldSlot: any = {
      date,
      startTime,
      userId,
      bookingId,
      holdExpiresAt,
      createdAt: admin.firestore.Timestamp.now(),
    };

    tx.update(docRef, {
      held: [...held, heldSlot],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export async function releaseHold(
  venueId: string,
  date: string,
  startTime: string
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  await db.runTransaction(async (tx) => {
    const docRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    const docSnap = await tx.get(docRef);
    if (!docSnap.exists) throw new Error("Venue slots not found");

    const data: any = docSnap.data();
    const held = (data.held || []).filter((s: any) => !(s.date === date && s.startTime === startTime));

    tx.update(docRef, {
      held,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export async function cleanExpiredHolds(venueId: string): Promise<number> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;
  let removedCount = 0;

  await db.runTransaction(async (tx) => {
    const docRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    const docSnap = await tx.get(docRef);
    if (!docSnap.exists) return;

    const data: any = docSnap.data();
    const now = admin.firestore.Timestamp.now();

    const held = (data.held || []).filter((slot: any) => {
      const isExpired = slot.holdExpiresAt && slot.holdExpiresAt.toMillis() <= now.toMillis();
      if (isExpired) removedCount++;
      return !isExpired;
    });

    if (removedCount > 0) {
      tx.update(docRef, {
        held,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return removedCount;
}

export async function reserveSlot(
  venueId: string,
  date: string,
  startTime: string,
  reservedBy: string,
  note?: string
): Promise<string> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  const reservedSlot: any = {
    date,
    startTime,
    note: note || null,
    reservedBy,
    reservedAt: admin.firestore.Timestamp.now(),
  };

  await db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId).update({
    reserved: admin.firestore.FieldValue.arrayUnion(reservedSlot),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const bookingId = generateBookingId("physical");
  return bookingId;
}

export async function unbookSlot(
  venueId: string,
  date: string,
  startTime: string
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  await db.runTransaction(async (tx) => {
    const docRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    const docSnap = await tx.get(docRef);
    if (!docSnap.exists) throw new Error("Venue slots not found");

    const data: any = docSnap.data();
    const bookings = (data.bookings || []).filter((s: any) => !(s.date === date && s.startTime === startTime));

    tx.update(docRef, {
      bookings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export async function blockSlot(
  venueId: string,
  date: string,
  startTime: string,
  reason?: string,
  blockedBy?: string
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  const blockedSlot: any = {
    date,
    startTime,
    blockedAt: admin.firestore.Timestamp.now(),
  };
  if (reason) blockedSlot.reason = reason;
  if (blockedBy) blockedSlot.blockedBy = blockedBy;

  await db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId).update({
    blocked: admin.firestore.FieldValue.arrayUnion(blockedSlot),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function unblockSlot(
  venueId: string,
  date: string,
  startTime: string
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  await db.runTransaction(async (tx) => {
    const docRef = db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId);
    const docSnap = await tx.get(docRef);
    if (!docSnap.exists) throw new Error("Venue slots not found");

    const data: any = docSnap.data();
    const blocked = (data.blocked || []).filter((s: any) => !(s.date === date && s.startTime === startTime));

    tx.update(docRef, {
      blocked,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

export async function updateSlotConfig(venueId: string, config: any): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  await db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId).update({
    config,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function generateSlots(
  venueId: string,
  startTime: string,
  endTime: string,
  slotDuration: number = 60,
  days: number = 7
): Promise<void> {
  if (!isAdminInitialized()) throw new Error("Admin SDK not initialized");
  const db = adminDb as admin.firestore.Firestore;

  const batch = db.batch();

  const now = new Date();
  const dates = [...Array(days)].map((_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const startHour = parseInt(startTime.split(":")[0], 10);
  const endHour = parseInt(endTime.split(":")[0], 10);

  for (const dateString of dates) {
    for (let hour = startHour; hour < endHour; hour += Math.max(1, Math.floor(slotDuration / 60))) {
      const hourString = `${hour.toString().padStart(2, "0")}:00`;
      const slotId = `${venueId}_${dateString}_${hourString.replace(":", "")}`;
      const slotRef = db.collection(COLLECTIONS.SLOTS).doc(slotId);
      batch.set(slotRef, { groundId: venueId, date: dateString, startTime: hourString, status: "AVAILABLE" }, { merge: true });
    }
  }

  const venueRef = db.collection(COLLECTIONS.VENUES).doc(venueId);
  batch.update(venueRef, { startTime, endTime });

  await batch.commit();
}
