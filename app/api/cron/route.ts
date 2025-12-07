/**
 * GET /api/cron
 *
 * Description:
 *   Maintenance cron endpoint that runs periodic cleanup tasks for the system.
 *   Current responsibilities:
 *     - Clean expired holds from `venueSlots` documents (remove entries from `held` array)
 *     - (Future) Other housekeeping tasks such as trimming old logs or stale bookings
 *
 * Invocation:
 *   - Intended to be called by a scheduler (Vercel Cron, Cloud Scheduler, or similar),
 *     or by an internal trusted service. The code does not currently enforce authentication.
 *
 * Authentication / Authorization:
 *   - No auth is required by the implementation. If you expose this endpoint publicly,
 *     protect it with a secret, network restrictions, or require a service token.
 *
 * Behavior / Side-effects:
 *   - Iterates all documents in `venueSlots` collection.
 *   - For each venueSlots doc, filters `held` entries and keeps only those where
 *     `holdExpiresAt` is in the future (compared against Firestore `Timestamp.now()`).
 *   - If expired holds are found, the doc is updated with the filtered `held` array
 *     and `updatedAt` server timestamp.
 *   - The function accumulates statistics: `venuesProcessed`, `holdsRemoved`, `errors`.
 *
 * Successful Response (200):
 *   {
 *     success: true,
 *     message: "Maintenance tasks completed successfully",
 *     stats: {
 *       venuesProcessed: number,
 *       holdsRemoved: number,
 *       errors: number
 *     }
 *   }
 *
 * Failure Responses:
 *   - 500 Internal Server Error
 *     { success: false, error: "Internal Server Error" }
 *     When an unhandled exception occurs during the cron task.
 *
 * Examples:
 *   - Triggered by scheduler: GET https://your-app.com/api/cron
 *   - Sample success body:
 *     {
 *       "success": true,
 *       "message": "Maintenance tasks completed successfully",
 *       "stats": { "venuesProcessed": 42, "holdsRemoved": 7, "errors": 0 }
 *     }
 *
 * Notes / Recommendations:
 *   - Because this iterates all `venueSlots` docs, for very large datasets consider
 *     paginating the query or limiting the number of documents processed per run to
 *     avoid timeouts and to reduce memory usage.
 *   - If stronger security is needed, require an Authorization header and verify
 *     a service token here before proceeding.
 *   - Ensure Firestore indexes and rules allow the service account to read/write
 *     `venueSlots` documents.
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
          return (
            slot.holdExpiresAt && slot.holdExpiresAt.toMillis() > now.toMillis()
          );
        });

        const removedCount = held.length - validHolds.length;

        if (removedCount > 0) {
          await venueDoc.ref.update({
            held: validHolds,
            updatedAt: FieldValue.serverTimestamp(),
          });

          stats.holdsRemoved += removedCount;
          console.log(
            `  ✅ Cleaned ${removedCount} expired holds from venue ${venueId}`,
          );
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
      { status: 500 },
    );
  }
}
