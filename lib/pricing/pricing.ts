export type BookingLike = {
  amount?: number | string | null;
  price?: number | string | null;
  [key: string]: any;
};

export type ComputedAmounts = {
  baseAmount: number; // canonical booking amount (in currency units)
  advanceAmount: number; // amount to pay now (rounded as per policy)
  totalAmount: number; // total booking amount (same as baseAmount for now)
};

// Default advance percentage applied when a new venue is created.
// Represents the % of the total slot price the user pays online via eSewa at booking time.
// The remaining balance is paid physically at the venue. Admin can override per-venue via advancePercentage.
export const DEFAULT_ADVANCE_PERCENT = 1;

function toNumber(v: number | string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Compute the canonical base amount for a booking object.
 * It prefers `amount` then `price` fields and falls back to 0.
 */
export function getBaseAmountFromBooking(booking: BookingLike): number {
  return toNumber(booking.amount ?? booking.price ?? 0);
}

/**
 * Compute advance amount using the configured percentage.
 * Uses Math.ceil to match existing UI behaviour.
 */
export function computeAdvanceAmount(baseAmount: number, percent = DEFAULT_ADVANCE_PERCENT): number {
  const raw = (baseAmount * percent) / 100;
  // preserve integer cents if amounts are integer already; use ceil for whole-unit rounding
  return Math.ceil(raw);
}

/**
 * Compute canonical amounts for a booking.
 */
export function computeAmountsFromBooking(booking: BookingLike, percent = DEFAULT_ADVANCE_PERCENT): ComputedAmounts {
  const baseAmount = getBaseAmountFromBooking(booking);
  const advanceAmount = computeAdvanceAmount(baseAmount, percent);
  const totalAmount = baseAmount;
  return { baseAmount, advanceAmount, totalAmount };
}

/**
 * Compute amounts from venue pricing and slot duration.
 * - `pricePerHour` is the venue price per hour
 * - `durationMinutes` is the slot duration in minutes
 * - `slotsCount` is number of consecutive slots booked (default 1)
 */
export function computeAmountsFromVenue(pricePerHour: number, durationMinutes: number, slotsCount: number = 1, percent = DEFAULT_ADVANCE_PERCENT): ComputedAmounts {
  const hours = (durationMinutes * slotsCount) / 60;
  const baseAmount = Math.round(Number(pricePerHour) * hours);
  const advanceAmount = computeAdvanceAmount(baseAmount, percent);
  const totalAmount = baseAmount;
  return { baseAmount, advanceAmount, totalAmount };
}

export default {
  getBaseAmountFromBooking,
  computeAdvanceAmount,
  computeAmountsFromBooking,
};
