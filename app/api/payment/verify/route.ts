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

interface EsewaVerificationResponse {
  product_code: string;
  total_amount: string;
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
    const { transactionUuid, productCode } = body;

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
    const verifyUrl = `${ESEWA_VERIFY_URL}?product_code=${productCode}&total_amount=0&transaction_uuid=${transactionUuid}`;
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('eSewa verification failed:', errorText);
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

    // Check if payment was completed
    const isVerified = verificationData.status === 'COMPLETE';

    return NextResponse.json({
      verified: isVerified,
      status: verificationData.status,
      transactionUuid: verificationData.transaction_uuid,
      refId: verificationData.ref_id,
      totalAmount: verificationData.total_amount,
      productCode: verificationData.product_code,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to verify payment',
        verified: false,
      },
      { status: 500 }
    );
  }
}
