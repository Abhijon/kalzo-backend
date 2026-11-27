export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  CREATED: "created",
  PAID: "paid",
  FAILED: "failed",
} as const;

export type PaymentStatusValue = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
