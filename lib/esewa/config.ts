/**
 * eSewa Payment Gateway Configuration
 * 
 * This module contains all eSewa-related constants and configuration.
 * Merchant credentials are stored in environment variables for security.
 */

// ============================================================================
// Environment-based Configuration
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';

// ============================================================================
// eSewa URLs
// ============================================================================

/**
 * Payment Form Submission URL
 * UAT: https://rc-epay.esewa.com.np/api/epay/main/v2/form
 * Production: https://epay.esewa.com.np/api/epay/main/v2/form
 */
export const ESEWA_PAYMENT_URL = isProduction
  ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
  : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';

/**
 * Transaction Status Verification URL
 * UAT: https://rc-epay.esewa.com.np/api/epay/transaction/status/
 * Production: https://epay.esewa.com.np/api/epay/transaction/status/
 */
export const ESEWA_VERIFY_URL = isProduction
  ? 'https://epay.esewa.com.np/api/epay/transaction/status/'
  : 'https://rc-epay.esewa.com.np/api/epay/transaction/status/';

// ============================================================================
// Merchant Configuration
// ============================================================================

/**
 * Merchant/Product Code
 * UAT: EPAYTEST
 * Production: Your actual merchant code from eSewa
 */
export const ESEWA_MERCHANT_CODE = process.env.NEXT_PUBLIC_ESEWA_MERCHANT_CODE || 'EPAYTEST';

/**
 * Secret Key for HMAC-SHA256 signature generation (Server-side only)
 * UAT: 8gBm/:&EnhH.1/q
 * Production: Your actual secret key from eSewa
 * 
 * IMPORTANT: Never expose this on the client side!
 */
export const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';

// ============================================================================
// Application URLs (Callbacks)
// ============================================================================

/**
 * Get the base URL for the application
 */
export const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Server-side
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  return isProduction 
    ? 'https://yourdomain.com' // Replace with your production domain
    : 'http://localhost:3000';
};

/**
 * Success callback URL
 */
export const getSuccessUrl = (): string => {
  return `${getBaseUrl()}/payment/success`;
};

/**
 * Failure callback URL
 */
export const getFailureUrl = (): string => {
  return `${getBaseUrl()}/payment/failure`;
};

// ============================================================================
// Payment Configuration
// ============================================================================

/**
 * Default values for payment parameters
 */
export const PAYMENT_DEFAULTS = {
  productServiceCharge: '0',
  productDeliveryCharge: '0',
  taxAmount: '0',
} as const;

/**
 * Signed field names for signature generation
 * These must be in the exact order as specified by eSewa
 */
export const SIGNED_FIELD_NAMES = 'total_amount,transaction_uuid,product_code';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EsewaPaymentParams {
  amount: string;
  taxAmount?: string;
  productServiceCharge?: string;
  productDeliveryCharge?: string;
  totalAmount: string;
  transactionUuid: string;
  productCode: string;
  successUrl: string;
  failureUrl: string;
}

export interface EsewaSignatureData {
  totalAmount: string;
  transactionUuid: string;
  productCode: string;
}

export interface EsewaVerificationParams {
  transactionUuid: string;
  productCode: string;
}
