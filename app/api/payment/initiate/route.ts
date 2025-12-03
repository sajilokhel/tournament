import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, isAdminInitialized } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
import { ESEWA_MERCHANT_CODE, ESEWA_SECRET_KEY, getSuccessUrl, getFailureUrl } from '@/lib/esewa/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, amount, totalAmount } = body;

    if (!bookingId || !totalAmount) {
      return NextResponse.json({ error: 'Missing bookingId or totalAmount' }, { status: 400 });
    }

    if (!isAdminInitialized()) {
      return NextResponse.json({ error: 'Admin SDK not initialized' }, { status: 500 });
    }

    // Read booking
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookingSnap.data() as any;

    // Generate transaction UUID
    const transactionUuid = `${bookingId}_${Date.now()}`;

    // Persist esewaTransactionUuid on booking and attach to held entry in venueSlots atomically
    if (booking.venueId) {
      const venueRef = db.collection('venueSlots').doc(booking.venueId);
      await db.runTransaction(async (t) => {
        const vSnap = await t.get(venueRef);
        if (!vSnap.exists) {
          // still update booking even if venueSlots missing
          t.update(bookingRef, {
            esewaTransactionUuid: transactionUuid,
            esewaInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }

        const vData = vSnap.data() as any;
        const held = (vData.held || []).map((h: any) => {
          if (h.bookingId === bookingId) {
            return { ...h, esewaTransactionUuid: transactionUuid };
          }
          return h;
        });

        t.update(venueRef, { held, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Update booking as part of same transaction
        t.update(bookingRef, {
          esewaTransactionUuid: transactionUuid,
          esewaInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } else {
      // No venueId; just update booking
      await bookingRef.update({
        esewaTransactionUuid: transactionUuid,
        esewaInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Generate signature (same algorithm as /api/payment/generate-signature)
    if (!ESEWA_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_MERCHANT_CODE}`;
    const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
    hmac.update(message);
    const signature = hmac.digest('base64');

    return NextResponse.json({
      success: true,
      transactionUuid,
      signature,
      paymentParams: {
        amount: String(amount || totalAmount), // Use passed amount or fallback to totalAmount
        totalAmount: String(totalAmount),
        transactionUuid,
        productCode: ESEWA_MERCHANT_CODE,
        successUrl: getSuccessUrl(),
        failureUrl: getFailureUrl(),
      },
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 });
  }
}
