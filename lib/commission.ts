/**
 * Commission calculation utilities for venue revenue
 */

export interface CommissionCalculation {
  grossRevenue: number;
  commissionPercentage: number;
  commissionAmount: number;
  netRevenue: number;
}

/**
 * Calculate commission deduction from gross revenue
 * @param grossRevenue - Total revenue before commission
 * @param commissionPercentage - Commission percentage (0-100), defaults to 0 if not provided
 * @returns Commission calculation breakdown
 */
export function calculateCommission(
  grossRevenue: number,
  commissionPercentage: number = 0
): CommissionCalculation {
  // Ensure commission percentage is within valid range
  const validPercentage = Math.max(0, Math.min(100, commissionPercentage || 0));
  
  const commissionAmount = (grossRevenue * validPercentage) / 100;
  const netRevenue = grossRevenue - commissionAmount;
  
  return {
    grossRevenue,
    commissionPercentage: validPercentage,
    commissionAmount,
    netRevenue,
  };
}

/**
 * Get commission percentage from venue data, defaulting to 0 if not found
 * @param venueData - Venue document data
 * @returns Commission percentage (0-100)
 */
export function getVenueCommission(venueData: any): number {
  return venueData?.commissionPercentage ?? 0;
}
