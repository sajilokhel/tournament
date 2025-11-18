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
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cleanExpiredHolds } from "@/lib/slotService";

export async function GET(req: NextRequest) {
  try {
    console.log("🔄 Starting cron job: Maintenance tasks");
    
    const stats = {
      venuesProcessed: 0,
      holdsRemoved: 0,
      errors: 0,
    };

    // Get all venue IDs from venueSlots collection
    const venueSlotsSnapshot = await getDocs(collection(db, "venueSlots"));

    for (const venueDoc of venueSlotsSnapshot.docs) {
      const venueId = venueDoc.id;
      stats.venuesProcessed++;

      try {
        const removed = await cleanExpiredHolds(venueId);
        stats.holdsRemoved += removed;
        
        if (removed > 0) {
          console.log(`  ✅ Cleaned ${removed} expired holds from venue ${venueId}`);
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