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
// Server-side initiation will persist esewaTransactionUuid; no client writes needed here.

/**
 * Request initiation from server which generates the transaction UUID
 * and returns a signature + payment params for submitting to eSewa.
 */
async function requestInitiationFromServer(
  bookingId: string
): Promise<{ signature: string; transactionUuid: string; paymentParams: EsewaPaymentParams } > {
  // Ask server to initiate payment for the bookingId and return the signed params.
  const response = await fetch('/api/payment/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to initiate payment');
  }

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to initiate payment');
  return { signature: data.signature, transactionUuid: data.transactionUuid, paymentParams: data.paymentParams };
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
  // optional amount is deprecated — server is authoritative. Keep for backward compat.
  amount?: number,
  options?: {
    taxAmount?: number;
    productServiceCharge?: number;
    productDeliveryCharge?: number;
  }
): Promise<void> {
  try {
    // Ask the server to create the canonical transaction UUID and signature
    const { signature, transactionUuid, paymentParams } = await requestInitiationFromServer(
      bookingId
    );

    // Submit payment form (redirects to eSewa). The server already persisted
    // the transactionUuid on the booking and updated the held entry atomically.
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
