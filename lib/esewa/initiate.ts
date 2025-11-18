/**
 * eSewa Payment Initiation Helper
 * 
 * This module provides client-side functions to initiate eSewa payments.
 * The payment form is dynamically created and submitted to redirect the user to eSewa.
 */

import {
  ESEWA_PAYMENT_URL,
  ESEWA_MERCHANT_CODE,
  PAYMENT_DEFAULTS,
  SIGNED_FIELD_NAMES,
  getSuccessUrl,
  getFailureUrl,
  type EsewaPaymentParams,
} from './config';

/**
 * Generate signature by calling the server-side API
 */
async function generateSignature(
  totalAmount: string,
  transactionUuid: string,
  productCode: string
): Promise<string> {
  const response = await fetch('/api/payment/generate-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      totalAmount,
      transactionUuid,
      productCode,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate signature');
  }

  const data = await response.json();
  return data.signature;
}

/**
 * Calculate total amount including tax, service charge, and delivery charge
 */
function calculateTotalAmount(
  amount: number,
  taxAmount: number = 0,
  productServiceCharge: number = 0,
  productDeliveryCharge: number = 0
): number {
  return amount + taxAmount + productServiceCharge + productDeliveryCharge;
}

/**
 * Create and submit a payment form to eSewa
 */
function submitPaymentForm(params: EsewaPaymentParams, signature: string): void {
  // Create a form element
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = ESEWA_PAYMENT_URL;

  // Add form fields
  const fields = {
    amount: params.amount,
    tax_amount: params.taxAmount || PAYMENT_DEFAULTS.taxAmount,
    total_amount: params.totalAmount,
    transaction_uuid: params.transactionUuid,
    product_code: params.productCode,
    product_service_charge: params.productServiceCharge || PAYMENT_DEFAULTS.productServiceCharge,
    product_delivery_charge: params.productDeliveryCharge || PAYMENT_DEFAULTS.productDeliveryCharge,
    success_url: params.successUrl,
    failure_url: params.failureUrl,
    signed_field_names: SIGNED_FIELD_NAMES,
    signature: signature,
  };

  // Create hidden input fields
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  // Append form to body and submit
  document.body.appendChild(form);
  form.submit();
}

/**
 * Initiate eSewa payment
 * 
 * @param bookingId - Unique booking identifier (will be used as transaction UUID)
 * @param amount - Payment amount in NPR
 * @param options - Optional tax, service charge, and delivery charge
 * @returns Promise that resolves when payment is initiated
 */
export async function initiateEsewaPayment(
  bookingId: string,
  amount: number,
  options?: {
    taxAmount?: number;
    productServiceCharge?: number;
    productDeliveryCharge?: number;
  }
): Promise<void> {
  try {
    // Prepare payment parameters
    const taxAmount = options?.taxAmount || 0;
    const productServiceCharge = options?.productServiceCharge || 0;
    const productDeliveryCharge = options?.productDeliveryCharge || 0;
    
    const totalAmount = calculateTotalAmount(
      amount,
      taxAmount,
      productServiceCharge,
      productDeliveryCharge
    );

    const transactionUuid = bookingId;
    const productCode = ESEWA_MERCHANT_CODE;

    // Generate signature from server
    const signature = await generateSignature(
      totalAmount.toString(),
      transactionUuid,
      productCode
    );

    // Prepare payment parameters
    const paymentParams: EsewaPaymentParams = {
      amount: amount.toString(),
      taxAmount: taxAmount.toString(),
      productServiceCharge: productServiceCharge.toString(),
      productDeliveryCharge: productDeliveryCharge.toString(),
      totalAmount: totalAmount.toString(),
      transactionUuid,
      productCode,
      successUrl: getSuccessUrl(),
      failureUrl: getFailureUrl(),
    };

    // Submit payment form (redirects to eSewa)
    submitPaymentForm(paymentParams, signature);
  } catch (error) {
    console.error('Error initiating eSewa payment:', error);
    throw error;
  }
}

/**
 * Verify if we're on a supported browser for form submission
 */
export function isBrowserSupported(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
