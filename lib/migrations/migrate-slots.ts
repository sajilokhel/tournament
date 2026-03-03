/**
 * Data Migration Script: Legacy Slots → Venue Slots Architecture
 * 
 * This script migrates from the old architecture (1 document per slot)
 * to the new architecture (1 document per venue with config + exceptions).
 * 
 * Run with: npx tsx lib/migrations/migrate-slots.ts
 * 
 * SAFETY FEATURES:
 * - Dry run mode (default)
 * - Backup old data
 * - Rollback capability
 * - Progress tracking
 * - Error recovery
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { COLLECTIONS } from "@/lib/utils";

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.env.DRY_RUN !== "false"; // Default to dry run
const BACKUP_DIR = "./backups";
const BATCH_SIZE = 500; // Firestore batch limit

// ============================================================================
// Types
// ============================================================================

interface OldSlot {
  venueId: string;
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
  notes?: string;
  holdExpiresAt?: any;
  createdAt?: any;
}

interface VenueSlotData {
  venueId: string;
  blocked: any[];
  bookings: any[];
  held: any[];
  reserved: any[];
}

interface MigrationStats {
  totalSlots: number;
  totalVenues: number;
  blocked: number;
  booked: number;
  held: number;
  reserved: number;
  available: number;
  errors: number;
  startTime: number;
  endTime?: number;
}

// ============================================================================
// Initialize Firebase Admin
// ============================================================================

function initializeFirebase() {
  try {
    // Try to use existing app
    return getFirestore();
  } catch {
    // Initialize new app
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (!serviceAccount) {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT_PATH not set");
      console.log("Set it with: export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json");
      process.exit(1);
    }
    
    if (!fs.existsSync(serviceAccount)) {
      console.error("❌ Service account file not found:", serviceAccount);
      process.exit(1);
    }
    
    const credentials = JSON.parse(fs.readFileSync(serviceAccount, "utf-8"));
    
    initializeApp({
      credential: cert(credentials),
    });
    
    return getFirestore();
  }
}

// ============================================================================
// Backup Functions
// ============================================================================

async function backupOldSlots(db: FirebaseFirestore.Firestore): Promise<string> {
  console.log("\n📦 Creating backup of old slots...");
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(BACKUP_DIR, `slots-backup-${timestamp}.json`);
  
  const slotsSnapshot = await db.collection(COLLECTIONS.SLOTS).get();
  const slots = slotsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  fs.writeFileSync(backupFile, JSON.stringify(slots, null, 2));
  
  console.log(`✅ Backed up ${slots.length} slots to ${backupFile}`);
  return backupFile;
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Infer slot configuration from existing slots
 */
function inferSlotConfig(slots: OldSlot[]) {
  if (slots.length === 0) {
    return null;
  }
  
  // Find earliest and latest times
  const times = slots.map((s) => s.startTime).sort();
  const startTime = times[0];
  
  // Calculate slot duration
  const firstSlot = slots[0];
  const [startHour, startMin] = firstSlot.startTime.split(":").map(Number);
  const [endHour, endMin] = firstSlot.endTime.split(":").map(Number);
  const slotDuration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  
  // Find latest end time
  const endTimes = slots.map((s) => s.endTime).sort();
  const endTime = endTimes[endTimes.length - 1];
  
  // Determine days of week
  const daysSet = new Set<number>();
  slots.forEach((slot) => {
    const date = new Date(slot.date);
    daysSet.add(date.getDay());
  });
  const daysOfWeek = Array.from(daysSet).sort();
  
  return {
    startTime,
    endTime,
    slotDuration,
    daysOfWeek,
    timezone: "Asia/Kathmandu",
  };
}

/**
 * Group slots by venue and convert to new format
 */
async function migrateVenue(
  db: FirebaseFirestore.Firestore,
  venueId: string,
  slots: OldSlot[],
  stats: MigrationStats
): Promise<void> {
  console.log(`\n🏟️  Migrating venue: ${venueId}`);
  console.log(`   Found ${slots.length} slots`);
  
  // Infer config
  const config = inferSlotConfig(slots);
  if (!config) {
    console.error(`   ❌ Could not infer config for venue ${venueId}`);
    stats.errors++;
    return;
  }
  
  console.log(`   Config: ${config.startTime}-${config.endTime}, ${config.slotDuration}min, days: ${config.daysOfWeek.join(",")}`);
  
  // Separate slots by type
  const venueData: VenueSlotData = {
    venueId,
    blocked: [],
    bookings: [],
    held: [],
    reserved: [],
  };
  
  for (const slot of slots) {
    switch (slot.status) {
      case "BLOCKED":
        venueData.blocked.push({
          date: slot.date,
          startTime: slot.startTime,
          reason: slot.reason,
          blockedAt: slot.createdAt || Timestamp.now(),
        });
        stats.blocked++;
        break;
        
      case "BOOKED":
        venueData.bookings.push({
          date: slot.date,
          startTime: slot.startTime,
          bookingId: slot.bookingId,
          bookingType: slot.bookingType || "website",
          status: "confirmed",
          customerName: slot.customerName,
          customerPhone: slot.customerPhone,
          userId: slot.userId,
          notes: slot.notes,
          createdAt: slot.createdAt || Timestamp.now(),
        });
        stats.booked++;
        break;
        
      case "HELD":
        // Only migrate non-expired holds
        if (slot.holdExpiresAt) {
          const now = Timestamp.now();
          const expiresAt = slot.holdExpiresAt;
          
          if (expiresAt.toMillis() > now.toMillis()) {
            venueData.held.push({
              date: slot.date,
              startTime: slot.startTime,
              userId: slot.userId,
              bookingId: slot.bookingId || `hold-${Date.now()}`,
              holdExpiresAt: slot.holdExpiresAt,
              createdAt: slot.createdAt || Timestamp.now(),
            });
            stats.held++;
          }
        }
        break;
        
      case "RESERVED":
        venueData.reserved.push({
          date: slot.date,
          startTime: slot.startTime,
          note: slot.notes,
          reservedBy: slot.userId || "unknown",
          reservedAt: slot.createdAt || Timestamp.now(),
        });
        stats.reserved++;
        break;
        
      case "AVAILABLE":
        // Don't store available slots
        stats.available++;
        break;
    }
  }
  
  console.log(`   📊 Blocked: ${venueData.blocked.length}, Booked: ${venueData.bookings.length}, Held: ${venueData.held.length}, Reserved: ${venueData.reserved.length}`);
  
  if (DRY_RUN) {
    console.log("   🔍 DRY RUN - Would create venueSlots document");
  } else {
    // Create new document
    await db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueId).set({
      venueId,
      config,
      blocked: venueData.blocked,
      bookings: venueData.bookings,
      held: venueData.held,
      reserved: venueData.reserved,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("   ✅ Created venueSlots document");
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log("🚀 Slot Migration Script");
  console.log("========================\n");
  
  if (DRY_RUN) {
    console.log("⚠️  DRY RUN MODE - No changes will be made");
    console.log("   Set DRY_RUN=false to perform actual migration\n");
  } else {
    console.log("⚠️  LIVE MODE - Changes will be written to database");
    console.log("   Press Ctrl+C within 5 seconds to cancel...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  
  const db = initializeFirebase();
  
  const stats: MigrationStats = {
    totalSlots: 0,
    totalVenues: 0,
    blocked: 0,
    booked: 0,
    held: 0,
    reserved: 0,
    available: 0,
    errors: 0,
    startTime: Date.now(),
  };
  
  // Backup old data
  if (!DRY_RUN) {
    await backupOldSlots(db);
  }
  
  console.log("\n📥 Fetching old slots...");
  const slotsSnapshot = await db.collection(COLLECTIONS.SLOTS).get();
  stats.totalSlots = slotsSnapshot.size;
  
  console.log(`Found ${stats.totalSlots} slots to migrate`);
  
  // Group by venue
  const venueSlots = new Map<string, OldSlot[]>();
  
  slotsSnapshot.docs.forEach((doc) => {
    const slot = doc.data() as OldSlot;
    
    if (!slot.venueId) {
      console.warn(`⚠️  Slot ${doc.id} has no venueId, skipping`);
      stats.errors++;
      return;
    }
    
    if (!venueSlots.has(slot.venueId)) {
      venueSlots.set(slot.venueId, []);
    }
    
    venueSlots.get(slot.venueId)!.push({
      ...slot,
      date: slot.date || doc.id.split("_")[1], // Extract from ID if missing
      startTime: slot.startTime || doc.id.split("_")[2],
    });
  });
  
  stats.totalVenues = venueSlots.size;
  console.log(`Found ${stats.totalVenues} venues`);
  
  // Migrate each venue
  let processed = 0;
  for (const [venueId, slots] of venueSlots) {
    try {
      await migrateVenue(db, venueId, slots, stats);
      processed++;
      
      // Progress update
      const progress = ((processed / stats.totalVenues) * 100).toFixed(1);
      console.log(`📈 Progress: ${processed}/${stats.totalVenues} (${progress}%)`);
      
    } catch (error) {
      console.error(`❌ Error migrating venue ${venueId}:`, error);
      stats.errors++;
    }
  }
  
  stats.endTime = Date.now();
  
  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Migration Summary");
  console.log("=".repeat(60));
  console.log(`Total Slots:        ${stats.totalSlots}`);
  console.log(`Total Venues:       ${stats.totalVenues}`);
  console.log(`Blocked:            ${stats.blocked}`);
  console.log(`Booked:             ${stats.booked}`);
  console.log(`Held:               ${stats.held}`);
  console.log(`Reserved:           ${stats.reserved}`);
  console.log(`Available (skipped): ${stats.available}`);
  console.log(`Errors:             ${stats.errors}`);
  console.log(`Duration:           ${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s`);
  console.log("=".repeat(60));
  
  const savedDocs = stats.totalSlots - stats.available;
  const reduction = ((1 - stats.totalVenues / savedDocs) * 100).toFixed(1);
  console.log(`\n💾 Storage reduction: ${savedDocs} docs → ${stats.totalVenues} docs (${reduction}% reduction)`);
  
  if (DRY_RUN) {
    console.log("\n✅ Dry run complete - no changes made");
    console.log("   Run with DRY_RUN=false to perform actual migration");
  } else {
    console.log("\n✅ Migration complete!");
    console.log("   ⚠️  Old slots collection preserved for rollback");
    console.log("   Review the new venueSlots collection before deleting old data");
  }
}

// ============================================================================
// Run Migration
// ============================================================================

migrate().catch((error) => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
