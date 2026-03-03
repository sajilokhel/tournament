import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Shared constants ──────────────────────────────────────────────────────────

/** Default timezone for all venue slot operations. */
export const DEFAULT_TIMEZONE = "Asia/Kathmandu";

/** Hold duration in milliseconds (5 minutes). */
export const HOLD_DURATION_MS = 5 * 60 * 1000;

/**
 * Generate a unique booking ID with a given prefix.
 * Format: `<prefix>_<timestamp>_<random>`
 */
export function generateBookingId(prefix: "booking" | "physical" = "booking"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
