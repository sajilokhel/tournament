/**
 * eSewa Payment Signature Generation API
 * 
 * This API endpoint generates secure HMAC-SHA256 signatures for eSewa payments.
 * The signature generation MUST be done server-side to keep the secret key secure.
 * 
 * Algorithm: HMAC-SHA256
 * Output: Base64 encoded string
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ESEWA_SECRET_KEY } from '@/lib/esewa/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { totalAmount, transactionUuid, productCode } = body;

    // Validate required parameters
    if (!totalAmount || !transactionUuid || !productCode) {
      return NextResponse.json(
        { error: 'Missing required parameters: totalAmount, transactionUuid, productCode' },
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

    // Create the message string in the exact order required by eSewa
    // Format: total_amount=100,transaction_uuid=11-201-13,product_code=EPAYTEST
    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;

    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
    hmac.update(message);
    const signature = hmac.digest('base64');

    return NextResponse.json({
      signature,
      message, // For debugging (remove in production)
    });
  } catch (error) {
    console.error('Error generating signature:', error);
    return NextResponse.json(
      { error: 'Failed to generate signature' },
      { status: 500 }
    );
  }
}
