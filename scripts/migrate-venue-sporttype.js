/**
 * Migration: Venue Sport Type
 *
 * Adds `sportType: "futsal"` to all existing venue documents that are
 * missing the `sportType` field.
 *
 * Run (dry run, default):
 *   node scripts/migrate-venue-sporttype.js
 *
 * Run (write to Firestore):
 *   DRY_RUN=false node scripts/migrate-venue-sporttype.js
 *
 * Requires:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
 *   OR the individual env vars in .env / .env.local:
 *     NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *     FIREBASE_CLIENT_EMAIL
 *     FIREBASE_PRIVATE_KEY
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

// ─── Load env files ───────────────────────────────────────────────────────────

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const projectRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(projectRoot, ".env"));
loadEnvFile(path.join(projectRoot, ".env.local"));

// ─── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN !== "false";
const DEFAULT_SPORT_TYPE = "futsal";
const BATCH_SIZE = 400;

// ─── Firebase Init ────────────────────────────────────────────────────────────

function initFirebase() {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath) {
    if (!fs.existsSync(saPath)) {
      console.error("❌  Service account file not found:", saPath);
      process.exit(1);
    }
    const creds = JSON.parse(fs.readFileSync(saPath, "utf-8"));
    initializeApp({ credential: cert(creds) });
    return getFirestore();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
    return getFirestore();
  }

  console.error("❌  No Firebase credentials found.");
  console.error(
    "    Either set FIREBASE_SERVICE_ACCOUNT_PATH, or ensure .env/.env.local contains:",
  );
  console.error("      NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  console.error("      FIREBASE_CLIENT_EMAIL");
  console.error("      FIREBASE_PRIVATE_KEY");
  process.exit(1);
}

// ─── Migration ────────────────────────────────────────────────────────────────

async function migrate() {
  console.log("=".repeat(60));
  console.log(" Venue Sport Type Migration");
  console.log("=".repeat(60));
  console.log(
    `  Mode : ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE — writing to Firestore"}`,
  );
  console.log(`  Default sport type: "${DEFAULT_SPORT_TYPE}"`);
  console.log("=".repeat(60));

  const db = initFirebase();

  const snapshot = await db.collection("venues").get();
  console.log(`\n  Total venues found : ${snapshot.size}`);

  const toUpdate = snapshot.docs.filter((doc) => {
    const data = doc.data();
    return !data.sportType;
  });

  console.log(`  Venues missing sportType: ${toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log("\n  ✅  Nothing to update.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n  [DRY RUN] Would update the following venues:");
    for (const doc of toUpdate) {
      const data = doc.data();
      console.log(`    • ${doc.id}  name="${data.name}"  → sportType="${DEFAULT_SPORT_TYPE}"`);
    }
    console.log(`\n  Run with DRY_RUN=false to apply changes.`);
    return;
  }

  // Process in batches
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { sportType: DEFAULT_SPORT_TYPE });
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`  ✅  Updated ${updated}/${toUpdate.length} venues...`);
  }

  console.log(`\n  ✅  Migration complete. Updated ${updated} venue(s).`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
