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
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { bookSlot } from '@/lib/slotService';
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
    // Note: totalAmount must match the original transaction amount
    const verifyUrl = `${ESEWA_VERIFY_URL}?product_code=${productCode}&total_amount=${totalAmount || 0}&transaction_uuid=${transactionUuid}`;
    
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
      return NextResponse.json({
        verified: false,
        status: verificationData.status,
        transactionUuid: verificationData.transaction_uuid,
        refId: verificationData.ref_id,
        totalAmount: verificationData.total_amount,
        productCode: verificationData.product_code,
      });
    }

    // Payment is verified, now update the booking in Firestore
    console.log('💾 Updating booking in database...');
    
    try {
      // Extract bookingId from transactionUuid (format: bookingId_timestamp)
      // If no underscore, assume it's just the bookingId (backward compatibility)
      const bookingId = transactionUuid.includes('_')
        ? transactionUuid.substring(0, transactionUuid.lastIndexOf('_'))
        : transactionUuid;

      // Get booking details
      console.log('booking1');
      const bookingRef = doc(db, 'bookings', bookingId);
      let bookingSnap = await getDoc(bookingRef);
      console.log('booking2');

      // If booking is not found, don't treat this as a hard failure.
      // eSewa has confirmed the payment, so we should record the payment
      // and return success to avoid losing the confirmed payment.
      if (!bookingSnap.exists()) {
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
        await updateDoc(bookingRef, {
          status: 'confirmed',
          paymentTimestamp: serverTimestamp(),
          esewaTransactionCode: verificationData.ref_id,
          esewaTransactionUuid: verificationData.transaction_uuid,
          esewaStatus: verificationData.status,
          esewaAmount: verificationData.total_amount,
          verifiedAt: serverTimestamp(),
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
