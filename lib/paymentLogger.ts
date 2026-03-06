import { db as clientDb } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, limit, getDocs } from "firebase/firestore";
import { db as adminDb, isAdminInitialized } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
        if (isAdminInitialized()) {
          const venueSnap = await adminDb.collection("venues").doc(data.venueId).get();
          if (venueSnap.exists) {
            const venueData = venueSnap.data();
            managerId = venueData?.managedBy || null;
            venueName = venueData?.name || null;
          }
        } else {
          const venueRef = doc(clientDb, "venues", data.venueId);
          const venueSnap = await getDoc(venueRef);
          if (venueSnap.exists()) {
            const venueData = venueSnap.data();
            managerId = venueData.managedBy || null;
            venueName = venueData.name || null;
          }
        }
      } catch (err) {
        console.error("Error fetching venue details for payment log:", err);
      }
    }

    // 2. Fetch user details (optional, but good for history)
    let userEmail = null;
    if (data.userId) {
      try {
        if (isAdminInitialized()) {
          const userSnap = await adminDb.collection("users").doc(data.userId).get();
          if (userSnap.exists) {
            userEmail = userSnap.data()?.email || null;
          }
        } else {
          const userRef = doc(clientDb, "users", data.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            userEmail = userSnap.data().email || null;
          }
        }
      } catch (err) {
        console.error("Error fetching user details for payment log:", err);
      }
    }

    // 3. Create payment record (idempotent)
    const dateString = new Date().toISOString().split('T')[0];

    // Idempotency: avoid creating duplicate payment records.
    // Check existing payments by `transactionUuid` first, then fallback
    // to matching `bookingId` + `refId` if provided.
    const txn = data.transactionUuid;
    const bId = data.bookingId;
    const rId = data.refId;

    // Helper: check in admin DB
    if (isAdminInitialized()) {
      try {
        if (txn) {
          const existing = await adminDb.collection('payments').where('transactionUuid', '==', txn).limit(1).get();
          if (!existing.empty) {
            console.log('ℹ️ Payment already logged (admin) for txn:', txn);
            return true;
          }
        }

        if (!txn && bId && rId) {
          const existing = await adminDb.collection('payments')
            .where('bookingId', '==', bId)
            .where('refId', '==', rId)
            .limit(1)
            .get();
          if (!existing.empty) {
            console.log('ℹ️ Payment already logged (admin) for booking+ref:', bId, rId);
            return true;
          }
        }

        const paymentRecordAdmin = {
          ...data,
          managerId,
          venueName,
          userEmail,
          createdAt: FieldValue.serverTimestamp(),
          dateString,
        } as any;
        await adminDb.collection('payments').add(paymentRecordAdmin);
      } catch (err) {
        console.error('Error checking/adding payment (admin):', err);
        throw err;
      }
    } else {
      try {
        const paymentsRef = collection(clientDb, 'payments');
        if (txn) {
          const q = query(paymentsRef, where('transactionUuid', '==', txn), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            console.log('ℹ️ Payment already logged (client) for txn:', txn);
            return true;
          }
        }

        if (!txn && bId && rId) {
          const q = query(paymentsRef, where('bookingId', '==', bId), where('refId', '==', rId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            console.log('ℹ️ Payment already logged (client) for booking+ref:', bId, rId);
            return true;
          }
        }

        const paymentRecord = {
          ...data,
          managerId,
          venueName,
          userEmail,
          createdAt: serverTimestamp(),
          dateString,
        };
        await addDoc(paymentsRef, paymentRecord);
      } catch (err) {
        console.error('Error checking/adding payment (client):', err);
        throw err;
      }
    }
    console.log("✅ Payment logged successfully:", data.transactionUuid);
    return true;
  } catch (error) {
    console.error("❌ Failed to log payment:", error);
    return false;
  }
}
