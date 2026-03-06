/**
 * Sport type constants shared across client and server.
 */

export const SPORT_TYPES = [
  "futsal",
  "cricket",
  "basketball",
  "volleyball",
  "badminton",
  "tennis",
  "football",
  "swimming",
  "table tennis",
  "boxing",
  "kabaddi",
  "archery",
  "cycling",
  "yoga",
  "gym",
] as const;

export type SportType = (typeof SPORT_TYPES)[number];

export const SPORT_TYPE_LABELS: Record<SportType, string> = {
  futsal: "Futsal",
  cricket: "Cricket",
  basketball: "Basketball",
  volleyball: "Volleyball",
  badminton: "Badminton",
  tennis: "Tennis",
  football: "Football",
  swimming: "Swimming",
  "table tennis": "Table Tennis",
  boxing: "Boxing",
  kabaddi: "Kabaddi",
  archery: "Archery",
  cycling: "Cycling",
  yoga: "Yoga",
  gym: "Gym",
};
