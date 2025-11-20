import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

export interface PaymentLogData {
  transactionUuid: string;
  bookingId: string;
  userId: string;
  venueId: string;
  amount: number;
  status: 'success' | 'failure' | 'pending' | 'refunded';
  method: 'esewa' | 'khalti' | 'cash' | 'other';
  productCode?: string;
  refId?: string;
  metadata?: any;
}

export async function logPayment(data: PaymentLogData) {
  try {
    // 1. Fetch venue to get managerId
    let managerId = null;
    let venueName = null;
    
    if (data.venueId) {
      try {
        const venueRef = doc(db, "venues", data.venueId);
        const venueSnap = await getDoc(venueRef);
        if (venueSnap.exists()) {
          const venueData = venueSnap.data();
          managerId = venueData.managedBy || null;
          venueName = venueData.name || null;
        }
      } catch (err) {
        console.error("Error fetching venue details for payment log:", err);
      }
    }

    // 2. Fetch user details (optional, but good for history)
    let userEmail = null;
    if (data.userId) {
        try {
            const userRef = doc(db, "users", data.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                userEmail = userSnap.data().email || null;
            }
        } catch (err) {
            console.error("Error fetching user details for payment log:", err);
        }
    }

    // 3. Create payment record
    const paymentRecord = {
      ...data,
      managerId,
      venueName,
      userEmail,
      createdAt: serverTimestamp(),
      // Add a searchable date string for easier client-side filtering if needed
      dateString: new Date().toISOString().split('T')[0], 
    };

    await addDoc(collection(db, "payments"), paymentRecord);
    console.log("✅ Payment logged successfully:", data.transactionUuid);
    return true;
  } catch (error) {
    console.error("❌ Failed to log payment:", error);
    return false;
  }
}
