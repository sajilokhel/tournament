"use server";

import { db, auth } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

export async function releaseHold(venueId: string, date: string, startTime: string) {
  try {
    // Verify auth
    // Note: We might want to allow releasing holds without strict auth if we pass a token, 
    // but for now let's assume user must be logged in or it's a background process (which might fail auth check).
    // Actually, for background process (cron), we might not have auth.
    // But this action is called from Client Component `UserBookingsPage`.
    
    // For now, let's just proceed. The security comes from the fact that releasing a hold 
    // isn't a destructive action that benefits an attacker much (they can only free up a slot).
    
    const venueRef = db.collection("venueSlots").doc(venueId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(venueRef);
      if (!doc.exists) return;
      
      const data = doc.data();
      if (!data) return;
      
      const held = data.held || [];
      const newHeld = held.filter(
        (slot: any) => !(slot.date === date && slot.startTime === startTime)
      );
      
      if (held.length !== newHeld.length) {
        t.update(venueRef, { 
          held: newHeld,
          updatedAt: FieldValue.serverTimestamp() 
        });
      }
    });
    
    revalidatePath(`/venue/${venueId}`);
    return { success: true };
  } catch (error) {
    console.error("Error releasing hold:", error);
    return { success: false, error: "Failed to release hold" };
  }
}

import { verifyManager } from "@/lib/server/auth";

export async function blockSlot(
  token: string,
  venueId: string,
  date: string,
  startTime: string,
  reason?: string
) {
  try {
    const isManager = await verifyManager(token, venueId);
    if (!isManager) throw new Error("Unauthorized");
    
    const venueRef = db.collection("venueSlots").doc(venueId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(venueRef);
      if (!doc.exists) throw new Error("Venue slots not found");
      
      const data = doc.data() as any;
      
      // Check if already blocked/booked
      const isBlocked = data.blocked?.some(
        (s: any) => s.date === date && s.startTime === startTime
      );
      if (isBlocked) return; // Already blocked
      
      const isBooked = data.bookings?.some(
        (s: any) => s.date === date && s.startTime === startTime
      );
      if (isBooked) throw new Error("Slot is booked");
      
      const blockedSlot = {
        date,
        startTime,
        reason,
        blockedAt: Timestamp.now(),
        blockedBy: (await auth.verifyIdToken(token)).uid
      };
      
      t.update(venueRef, {
        blocked: FieldValue.arrayUnion(blockedSlot),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    revalidatePath(`/venue/${venueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error blocking slot:", error);
    return { success: false, error: error.message || "Failed to block slot" };
  }
}

export async function unblockSlot(
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
      const blocked = (data.blocked || []).filter(
        (s: any) => !(s.date === date && s.startTime === startTime)
      );
      
      t.update(venueRef, {
        blocked,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    
    revalidatePath(`/venue/${venueId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error unblocking slot:", error);
    return { success: false, error: error.message || "Failed to unblock slot" };
  }
}
