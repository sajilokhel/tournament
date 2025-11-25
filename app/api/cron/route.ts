/**
 * Cron API Route - Maintenance tasks
 * 
 * In the new architecture, slots are generated on-demand, so this
 * cron job now only handles cleanup tasks:
 * - Clean expired holds
 * - (Future: Clean old booking records, etc.)
 * 
 * Can be triggered by Vercel Cron or external scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin"; // Use Admin SDK
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    console.log("🔄 Starting cron job: Maintenance tasks");
    
    const stats = {
      venuesProcessed: 0,
      holdsRemoved: 0,
      errors: 0,
    };

    // Get all venue IDs from venueSlots collection
    const venueSlotsSnapshot = await db.collection("venueSlots").get();

    for (const venueDoc of venueSlotsSnapshot.docs) {
      const venueId = venueDoc.id;
      stats.venuesProcessed++;

      try {
        const data = venueDoc.data();
        const held = data.held || [];
        const now = Timestamp.now();
        
        const validHolds = held.filter((slot: any) => {
          return slot.holdExpiresAt && slot.holdExpiresAt.toMillis() > now.toMillis();
        });
        
        const removedCount = held.length - validHolds.length;
        
        if (removedCount > 0) {
          await venueDoc.ref.update({
            held: validHolds,
            updatedAt: FieldValue.serverTimestamp(),
          });
          
          stats.holdsRemoved += removedCount;
          console.log(`  ✅ Cleaned ${removedCount} expired holds from venue ${venueId}`);
        }
      } catch (error) {
        console.error(`  ❌ Error cleaning holds for venue ${venueId}:`, error);
        stats.errors++;
      }
    }

    console.log("✅ Cron job completed:", stats);

    return NextResponse.json({
      success: true,
      message: "Maintenance tasks completed successfully",
      stats,
    });
  } catch (error) {
    console.error("❌ Cron job error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}