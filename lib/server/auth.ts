import "server-only";
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
