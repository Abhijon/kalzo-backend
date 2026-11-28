import type { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  getRazorpayClient,
  inrToPaise,
  razorpayKeyId,
  verifyPaymentSignature,
} from "../lib/razorpay";
import { ApiError } from "../utils/apiError";
import { newBookingCodes } from "../utils/bookingCodes";
import { PAYMENT_STATUS } from "../utils/paymentStatus";
import { bookingSelect } from "./booking.service";

const payableStatuses = ["pending", "accepted"] as const;

function assertCustomerOwnsBooking(
  booking: { customerUserId: string } | null,
  userId: string,
) {
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.customerUserId !== userId) {
    throw new ApiError(403, "You do not have access to this booking");
  }
}

function assertPayable(booking: {
  status: string;
  amountInr: number;
  paymentStatus: string;
}) {
  if (booking.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new ApiError(409, "Booking is already paid");
  }
  if (!(payableStatuses as readonly string[]).includes(booking.status)) {
    throw new ApiError(400, `Cannot pay for a booking in status "${booking.status}"`);
  }
  if (!booking.amountInr || booking.amountInr < 1) {
    throw new ApiError(400, "Booking amount must be at least ₹1 to charge");
  }
}

export type CreateOrderResult = {
  bookingId: string;
  amountInr: number;
  amountPaise: number;
  currency: "INR";
  keyId: string;
  orderId: string;
  paymentStatus: PaymentStatus;
  reused: boolean;
};

/**
 * Create (or reuse) a Razorpay order for a booking.
 * Idempotency:
 * - Already paid → 409 from assert (caller may short-circuit)
 * - Same Idempotency-Key → return existing order
 * - Existing open razorpayOrderId on booking → reuse, do not create another charge order
 */
export async function createPaymentOrder(input: {
  bookingId: string;
  customerUserId: string;
  idempotencyKey: string;
}): Promise<CreateOrderResult> {
  const key = input.idempotencyKey.trim();
  if (key.length < 8 || key.length > 128) {
    throw new ApiError(400, "Idempotency-Key must be 8–128 characters");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: bookingSelect,
  });
  assertCustomerOwnsBooking(booking, input.customerUserId);
  assertPayable(booking!);

  // Same key already used on another booking
  const byKey = await prisma.booking.findUnique({
    where: { paymentIdempotencyKey: key },
    select: { id: true, razorpayOrderId: true, paymentStatus: true, amountInr: true },
  });
  if (byKey && byKey.id !== input.bookingId) {
    throw new ApiError(409, "Idempotency-Key was already used for another booking");
  }

  // Reuse existing order for this booking (same key or open order)
  if (
    booking!.razorpayOrderId &&
    (booking!.paymentStatus === PAYMENT_STATUS.CREATED ||
      booking!.paymentIdempotencyKey === key)
  ) {
    return {
      bookingId: booking!.id,
      amountInr: booking!.amountInr,
      amountPaise: inrToPaise(booking!.amountInr),
      currency: "INR",
      keyId: razorpayKeyId(),
      orderId: booking!.razorpayOrderId,
      paymentStatus: booking!.paymentStatus as PaymentStatus,
      reused: true,
    };
  }

  if (byKey?.razorpayOrderId) {
    return {
      bookingId: byKey.id,
      amountInr: byKey.amountInr,
      amountPaise: inrToPaise(byKey.amountInr),
      currency: "INR",
      keyId: razorpayKeyId(),
      orderId: byKey.razorpayOrderId,
      paymentStatus: byKey.paymentStatus,
      reused: true,
    };
  }

  const amountPaise = inrToPaise(booking!.amountInr);
  const rzp = getRazorpayClient();
  const order = await rzp.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `bk_${booking!.id.replace(/-/g, "").slice(0, 32)}`,
    notes: {
      bookingId: booking!.id,
      customerUserId: input.customerUserId,
    },
  });

  const orderId = String(order.id);
  try {
    const updated = await prisma.booking.update({
      where: { id: booking!.id },
      data: {
        razorpayOrderId: orderId,
        paymentIdempotencyKey: key,
        paymentStatus: PAYMENT_STATUS.CREATED,
      },
      select: bookingSelect,
    });

    return {
      bookingId: updated.id,
      amountInr: updated.amountInr,
      amountPaise,
      currency: "INR",
      keyId: razorpayKeyId(),
      orderId,
      paymentStatus: updated.paymentStatus,
      reused: false,
    };
  } catch (err: unknown) {
    // Unique collision on idempotency key under race — return winner's order
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      const again = await prisma.booking.findUnique({
        where: { id: input.bookingId },
        select: bookingSelect,
      });
      if (again?.razorpayOrderId) {
        return {
          bookingId: again.id,
          amountInr: again.amountInr,
          amountPaise: inrToPaise(again.amountInr),
          currency: "INR",
          keyId: razorpayKeyId(),
          orderId: again.razorpayOrderId,
          paymentStatus: again.paymentStatus,
          reused: true,
        };
      }
    }
    throw err;
  }
}

export type VerifyPaymentResult = {
  booking: Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;
  alreadyPaid: boolean;
};

/**
 * Verify Razorpay Checkout signature and mark booking paid (idempotent).
 */
export async function verifyPayment(input: {
  bookingId: string;
  customerUserId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<VerifyPaymentResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: bookingSelect,
  });
  assertCustomerOwnsBooking(booking, input.customerUserId);

  if (booking!.paymentStatus === PAYMENT_STATUS.PAID) {
    if (
      booking!.razorpayPaymentId &&
      booking!.razorpayPaymentId !== input.paymentId
    ) {
      throw new ApiError(409, "Booking already paid with a different payment");
    }
    return { booking: booking!, alreadyPaid: true };
  }

  if (!booking!.razorpayOrderId) {
    throw new ApiError(400, "No payment order exists for this booking. Create an order first.");
  }
  if (booking!.razorpayOrderId !== input.orderId) {
    throw new ApiError(400, "Order id does not match this booking");
  }

  const ok = verifyPaymentSignature({
    orderId: input.orderId,
    paymentId: input.paymentId,
    signature: input.signature,
  });
  if (!ok) throw new ApiError(400, "Invalid Razorpay payment signature");

  const codes = newBookingCodes();

  // Atomic: only one request can flip unpaid/created → paid
  const updated = await prisma.booking.updateMany({
    where: {
      id: input.bookingId,
      paymentStatus: { in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.CREATED] },
      razorpayOrderId: input.orderId,
    },
    data: {
      paymentStatus: PAYMENT_STATUS.PAID,
      razorpayPaymentId: input.paymentId,
      paidAt: new Date(),
      arrivalCode: codes.arrival,
      closingCode: codes.closing,
      arrivalAttempts: 0,
      closingAttempts: 0,
    },
  });

  if (updated.count === 0) {
    const latest = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: bookingSelect,
    });
    if (latest?.paymentStatus === PAYMENT_STATUS.PAID) {
      return { booking: latest, alreadyPaid: true };
    }
    throw new ApiError(409, "Could not mark booking as paid (concurrent update)");
  }

  const paid = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: bookingSelect,
  });
  if (!paid) throw new ApiError(404, "Booking not found");
  return { booking: paid, alreadyPaid: false };
}

export async function getPaymentStatus(input: {
  bookingId: string;
  customerUserId: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: bookingSelect,
  });
  assertCustomerOwnsBooking(booking, input.customerUserId);
  return booking!;
}
