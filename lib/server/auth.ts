import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";

export async function verifyUser(token: string) {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error("Error verifying token:", error);
    throw new Error("Unauthorized");
  }
}

export async function verifyManager(token: string, venueId: string) {
  try {
    const userId = await verifyUser(token);

    const venueDoc = await db.collection("venues").doc(venueId).get();
    if (!venueDoc.exists) return false;

    const venueData = venueDoc.data();
    return venueData?.managedBy === userId;
  } catch (error) {
    console.error("Error verifying manager:", error);
    return false;
  }
}

/**
 * Extract the Bearer token string from an Authorization header.
 * Returns null if the header is missing or not a Bearer token.
 */
export function extractBearerToken(request: NextRequest | Request): string | null {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

/**
 * Verify the Bearer token on a request and return the decoded uid.
 * Throws a NextResponse (401) if missing or invalid — call inside try/catch
 * or use the returned NextResponse as an early-return guard.
 */
export async function verifyRequestToken(
  request: NextRequest | Request,
): Promise<{ uid: string } | NextResponse> {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

/**
 * Check if a user (by uid) has role "manager" or "admin" in Firestore.
 */
export async function isManagerOrAdmin(uid: string): Promise<boolean> {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return false;
    const r = doc.data()?.role;
    return r === "manager" || r === "admin";
  } catch (e) {
    console.warn("Failed to check caller role", e);
    return false;
  }
}

/**
 * Get the role of a user by uid. Returns "user" as default.
 */
export async function getUserRole(uid: string): Promise<string> {
  try {
    const doc = await db.collection("users").doc(uid).get();
    return doc.exists ? (doc.data()?.role ?? "user") : "user";
  } catch {
    return "user";
  }
}
