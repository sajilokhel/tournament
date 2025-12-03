/**
 * eSewa Payment Verification API
 * 
 * This API endpoint verifies the transaction status with eSewa after payment.
 * According to eSewa docs: If response is not received within 5 minutes,
 * use status check API to confirm payment.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ESEWA_VERIFY_URL, ESEWA_SECRET_KEY } from '@/lib/esewa/config';
import { db, auth, isAdminInitialized } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
import { bookSlot } from '@/lib/slotService.admin';
import { logPayment } from '@/lib/paymentLogger';

interface EsewaVerificationResponse {
  product_code: string;
  total_amount: string | number;
  transaction_uuid: string;
  status: 'COMPLETE' | 'PENDING' | 'FAILED' | 'INITIATED';
  ref_id: string;
}

/**
 * Generate signature for verification request
 */
function generateVerificationSignature(transactionUuid: string): string {
  const message = `transaction_uuid=${transactionUuid}`;
  const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
  hmac.update(message);
  return hmac.digest('base64');
}

// Helper: locate booking by transaction UUID with multiple strategies.
async function locateBookingByTxn(rawTxn: string) {
  const coll = db.collection('bookings');
  let bookingRef = coll.doc(rawTxn);
  let bookingSnap = await bookingRef.get();

  if (!bookingSnap.exists && rawTxn.includes('_')) {
    const prefixId = rawTxn.substring(0, rawTxn.lastIndexOf('_'));
    bookingRef = coll.doc(prefixId);
    bookingSnap = await bookingRef.get();
  }

  if (!bookingSnap.exists) {
    const q = await coll.where('esewaTransactionUuid', '==', rawTxn).limit(1).get();
    if (!q.empty) {
      bookingSnap = q.docs[0];
      bookingRef = coll.doc(bookingSnap.id);
    }
  }

  return { bookingRef, bookingSnap };
}

// Helper: mark booking as failed/cancelled (server-side update)
async function markBookingFailed(bookingRef: any, reason: string) {
  await bookingRef.update({
    status: 'payment_failed',
    verificationFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    verificationFailureReason: reason,
  });
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionUuid, productCode, totalAmount } = body;

    console.log('🔍 Verification request:', { transactionUuid, productCode, totalAmount });

    // Validate required parameters
    if (!transactionUuid || !productCode) {
      return NextResponse.json(
        { error: 'Missing required parameters: transactionUuid, productCode' },
        { status: 400 }
      );
    }

    // Validate secret key is configured
    if (!ESEWA_SECRET_KEY) {
      console.error('ESEWA_SECRET_KEY is not configured');
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    // Generate signature for verification
    const signature = generateVerificationSignature(transactionUuid);

    // Prepare verification request
    // Normalize totalAmount: remove trailing .0 or .00 if it's an integer value
    // eSewa might return 200.0 but expects 200 in verification if that's what was signed/initiated.
    const normalizedAmount = Number(totalAmount);
    // Use the normalized amount for verification URL
    const verifyUrl = `${ESEWA_VERIFY_URL}?product_code=${productCode}&total_amount=${normalizedAmount}&transaction_uuid=${transactionUuid}`;
    
    console.log('📡 Calling eSewa verify URL:', verifyUrl);
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('❌ eSewa verification failed:', errorText);
      return NextResponse.json(
        { 
          error: 'Payment verification failed',
          details: errorText,
          verified: false,
          status: 'FAILED', // Explicit status for client
        },
        { status: 400 }
      );
    }

    const verificationData: EsewaVerificationResponse = await verifyResponse.json();
    console.log('✅ eSewa verification response:', verificationData);

    // Check if payment was completed
    const isVerified = verificationData.status === 'COMPLETE';

    if (!isVerified) {
      console.log('⚠️ Payment not complete, status:', verificationData.status);

      // For non-verified statuses, be conservative: do NOT delete or remove
      // the booking/held record. Only mark the booking as failed for explicit
      // terminal statuses (e.g. CANCELED, FAILED). If eSewa returns NOT_FOUND
      // or PENDING, leave the booking as `pending_payment` so the user can
      // retry or cancel the hold manually from the UI.
      const terminalFailureStatuses = ['CANCELED', 'FAILED'];
      const rawTxn = verificationData.transaction_uuid;

      try {
        const { bookingRef, bookingSnap } = await locateBookingByTxn(rawTxn);

        const bookingId = bookingSnap?.exists ? bookingRef.id : (rawTxn.includes('_') ? rawTxn.substring(0, rawTxn.lastIndexOf('_')) : rawTxn);

        if (bookingSnap?.exists && terminalFailureStatuses.includes(verificationData.status)) {
          // Terminal failure: mark booking as failed (but do not delete).
          await markBookingFailed(bookingRef, verificationData.status);
          return NextResponse.json({
            verified: false,
            status: verificationData.status,
            transactionUuid: verificationData.transaction_uuid,
            refId: verificationData.ref_id,
            totalAmount: verificationData.total_amount,
            productCode: verificationData.product_code,
            bookingUpdated: true,
            bookingId,
          });
        }

        // Non-terminal (e.g. NOT_FOUND, PENDING) — keep the booking untouched
        // and return a clear response so the UI can show "Payment not done".
        return NextResponse.json({
          verified: false,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingFound: bookingSnap?.exists || false,
          bookingId: bookingId,
          message: 'Payment not completed; booking retained (no automatic deletion).',
        });
      } catch (err) {
        console.warn('Failed to handle non-verified payment:', err);
        return NextResponse.json({
          verified: false,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
        });
      }
    }

    // Payment is verified, now update the booking in Firestore
    console.log('💾 Updating booking in database...');
    
    try {
      // Extract bookingId from transactionUuid (format: bookingId_timestamp)
      // If no underscore, assume it's just the bookingId (backward compatibility)
      // Locate booking: prefer exact match, then prefix-before-last-underscore,
      // then query by `esewaTransactionUuid` field.
      const rawTxn = transactionUuid;
      let bookingRef = db.collection('bookings').doc(rawTxn);
      console.log('booking1');
      let bookingSnap = await bookingRef.get();

      if (!bookingSnap.exists && rawTxn.includes('_')) {
        const prefixId = rawTxn.substring(0, rawTxn.lastIndexOf('_'));
        bookingRef = db.collection('bookings').doc(prefixId);
        bookingSnap = await bookingRef.get();
      }

      if (!bookingSnap.exists) {
        const q = await db.collection('bookings').where('esewaTransactionUuid', '==', rawTxn).limit(1).get();
        if (!q.empty) {
          bookingSnap = q.docs[0];
          bookingRef = db.collection('bookings').doc(bookingSnap.id);
        }
      }
      console.log('booking2');

      // Resolve bookingId for later logging/response use (prefer found doc id)
      const bookingId = bookingSnap.exists
        ? bookingRef.id
        : rawTxn.includes('_')
        ? rawTxn.substring(0, rawTxn.lastIndexOf('_'))
        : rawTxn;

      // If booking is not found, don't treat this as a hard failure.
      // eSewa has confirmed the payment, so we should record the payment
      // and return success to avoid losing the confirmed payment.
      if (!bookingSnap.exists) {
        console.warn('⚠️ Booking not found in database:', bookingId);

        // Log payment record so there's an audit trail even if booking is missing
        await logPayment({
          transactionUuid: verificationData.transaction_uuid,
          bookingId: bookingId,
          userId: '',
          venueId: '',
          amount: parseFloat(String(verificationData.total_amount).replace(/,/g, '')),
          status: 'success',
          method: 'esewa',
          productCode: verificationData.product_code,
          refId: verificationData.ref_id,
          metadata: {
            note: 'esewa confirmed but booking document missing',
            esewaStatus: verificationData.status,
          },
        });

        return NextResponse.json({
          verified: true,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingFound: false,
          message: 'Payment verified but booking document not found; payment logged for manual reconciliation',
        });
      }

      const booking = bookingSnap.data();
      console.log('booking3');

      // Check if already confirmed to prevent duplicate processing
      if (booking.status === 'confirmed') {
        console.log('ℹ️ Booking already confirmed');
        // Still ensure payment is logged (idempotent):
        await logPayment({
          transactionUuid: verificationData.transaction_uuid,
          bookingId: bookingId,
          userId: booking.userId || '',
          venueId: booking.venueId || '',
          amount: parseFloat(String(verificationData.total_amount).replace(/,/g, '')),
          status: 'success',
          method: 'esewa',
          productCode: verificationData.product_code,
          refId: verificationData.ref_id,
          metadata: { esewaStatus: verificationData.status, alreadyConfirmed: true },
        });

        return NextResponse.json({
          verified: true,
          status: 'COMPLETE',
          alreadyConfirmed: true,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingData: {
            bookingId,
            venueId: booking.venueId,
            userId: booking.userId,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            amount: booking.amount,
            bookingType: booking.bookingType,
          },
        });
      }

      console.log('📄 Booking data:', booking);

      try {
        // Convert hold to confirmed booking in venueSlots
        console.log('🔄 Converting hold to confirmed booking...');
        await bookSlot(booking.venueId, booking.date, booking.startTime, {
          bookingId: bookingId,
          bookingType: 'website',
          status: 'confirmed',
          userId: booking.userId,
        });

        // Update booking document
        console.log('✅ Updating booking document...');
        await bookingRef.update({
          status: 'confirmed',
          paymentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
          esewaTransactionCode: verificationData.ref_id,
          esewaTransactionUuid: verificationData.transaction_uuid,
          esewaStatus: verificationData.status,
          esewaAmount: verificationData.total_amount,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log payment to history
        await logPayment({
          transactionUuid: verificationData.transaction_uuid,
          bookingId: bookingId,
          userId: booking.userId,
          venueId: booking.venueId,
          amount: parseFloat(String(verificationData.total_amount).replace(/,/g, '')),
          status: 'success',
          method: 'esewa',
          productCode: verificationData.product_code,
          refId: verificationData.ref_id,
          metadata: {
            esewaStatus: verificationData.status,
            bookingDate: booking.date,
            bookingTime: booking.startTime,
          },
        });

        console.log('🎉 Payment verification and booking confirmation complete!');

        return NextResponse.json({
          verified: true,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingConfirmed: true,
          bookingData: {
            bookingId,
            venueId: booking.venueId,
            userId: booking.userId,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            amount: booking.amount,
            bookingType: booking.bookingType,
          },
        });
      } catch (innerDbError) {
        console.error('❌ Database update error during confirmation:', innerDbError);

        // Log payment so we keep an audit of successful payment even if DB update failed
        try {
          await logPayment({
            transactionUuid: verificationData.transaction_uuid,
            bookingId: bookingId,
            userId: booking.userId || '',
            venueId: booking.venueId || '',
            amount: parseFloat(String(verificationData.total_amount).replace(/,/g, '')),
            status: 'success',
            method: 'esewa',
            productCode: verificationData.product_code,
            refId: verificationData.ref_id,
            metadata: { esewaStatus: verificationData.status, dbError: String(innerDbError) },
          });
        } catch (logErr) {
          console.error('❌ Failed to log payment after DB error:', logErr);
        }

        // Return success response to eSewa to indicate verification was received.
        return NextResponse.json({
          verified: true,
          status: verificationData.status,
          transactionUuid: verificationData.transaction_uuid,
          refId: verificationData.ref_id,
          totalAmount: verificationData.total_amount,
          productCode: verificationData.product_code,
          bookingConfirmed: false,
          bookingUpdateFailed: true,
          message: 'Payment verified but failed to update booking; payment logged for manual reconciliation',
        });
      }
    } catch (dbError) {
      console.error('❌ Database update error:', dbError);
      return NextResponse.json({
        verified: true,
        status: verificationData.status,
        error: 'Payment verified but booking update failed',
        transactionUuid: verificationData.transaction_uuid,
        refId: verificationData.ref_id,
      }, { status: 500 });  
    }
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to verify payment',
        verified: false,
      },
      { status: 500 }
    );
  }
}
