export const BOOKING_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  JOB_STARTED: "job_started",
  COMPLETED: "completed",
} as const;

export type BookingStatusValue = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** All Prisma BookingStatus enum values, in display order. */
export const BOOKING_STATUSES: BookingStatusValue[] = Object.values(BOOKING_STATUS);

const ALLOWED: Record<BookingStatusValue, BookingStatusValue[]> = {
  pending: ["accepted", "rejected"],
  accepted: ["job_started", "rejected"],
  rejected: [],
  job_started: ["completed"],
  completed: [],
};

export function canTransition(from: BookingStatusValue, to: BookingStatusValue): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
