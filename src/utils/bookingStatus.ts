export const BOOKING_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  ARRIVED: "arrived",
  ARRIVAL_CONFIRMED: "arrival_confirmed",
  PERFORMING: "performing",
  FINISHED: "finished",
  COMPLETED: "completed",
} as const;

export type BookingStatusValue = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** All Prisma BookingStatus enum values, in display order. */
export const BOOKING_STATUSES: BookingStatusValue[] = Object.values(BOOKING_STATUS);

/**
 * Direct artist status patches only.
 * OTP verify and venue-video use dedicated endpoints.
 */
const ALLOWED: Record<BookingStatusValue, BookingStatusValue[]> = {
  pending: ["accepted", "rejected"],
  accepted: ["arrived", "rejected"],
  rejected: [],
  arrived: [],
  arrival_confirmed: [],
  performing: ["finished"],
  finished: [],
  completed: [],
};

export function canTransition(from: BookingStatusValue, to: BookingStatusValue): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export const OTP_MAX_ATTEMPTS = 5;
