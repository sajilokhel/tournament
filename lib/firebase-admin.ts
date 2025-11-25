import "server-only";
import * as admin from "firebase-admin";

// Check if required environment variables are present
const requiredEnvVars = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.warn(
    `⚠️ Firebase Admin: Missing environment variables: ${missingVars.join(", ")}`
  );
  console.warn("⚠️ Firebase Admin SDK will not be initialized. Server-side features may not work.");
}

// Initialize Firebase Admin only if all required variables are present
if (!admin.apps.length && missingVars.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: requiredEnvVars.projectId!,
        clientEmail: requiredEnvVars.clientEmail!,
        privateKey: requiredEnvVars.privateKey!.replace(/\\n/g, "\n"),
      }),
    });
    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
    throw error;
  }
}

// Export admin services - will throw error if not initialized
export const db = admin.apps.length > 0 ? admin.firestore() : null as any;
export const auth = admin.apps.length > 0 ? admin.auth() : null as any;

// Helper to check if admin is initialized
export const isAdminInitialized = () => admin.apps.length > 0;
