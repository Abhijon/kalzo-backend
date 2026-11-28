import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { newBookingCodes } from "../utils/bookingCodes";
import { PAYMENT_STATUS } from "../utils/paymentStatus";

export const bookingSelect = {
  id: true,
  customerUserId: true,
  artistProfileId: true,
  eventDate: true,
  address: true,
  guests: true,
  note: true,
  amountInr: true,
  status: true,
  paymentStatus: true,
  paymentIdempotencyKey: true,
  razorpayOrderId: true,
  razorpayPaymentId: true,
  paidAt: true,
  arrivalCode: true,
  closingCode: true,
  arrivalAttempts: true,
  closingAttempts: true,
  venueVideoPath: true,
  payoutStatus: true,
  createdAt: true,
  updatedAt: true,
  review: {
    select: {
      id: true,
      rating: true,
      body: true,
      tags: true,
      createdAt: true,
    },
  },
  artist: {
    select: {
      id: true,
      stageName: true,
      discipline: true,
      subcategory: true,
      photoPath: true,
      rateInr: true,
      baseCity: true,
      user: { select: { id: true, email: true } },
    },
  },
  customer: {
    select: {
      id: true,
      email: true,
      customerProfile: {
        select: { fullName: true, mobileNumber: true, location: true },
      },
    },
  },
} satisfies Prisma.BookingSelect;

export type BookingCreateInput = {
  customerUserId: string;
  artistProfileId: string;
  eventDate: Date;
  address: string;
  guests?: string | null;
  note?: string | null;
  amountInr?: number;
};

export function createBooking(data: BookingCreateInput) {
  return prisma.booking.create({
    data: {
      customerUserId: data.customerUserId,
      artistProfileId: data.artistProfileId,
      eventDate: data.eventDate,
      address: data.address,
      guests: data.guests ?? null,
      note: data.note ?? null,
      amountInr: data.amountInr ?? 0,
      status: "pending",
    },
    select: bookingSelect,
  });
}

export function findBookingById(id: string) {
  return prisma.booking.findUnique({ where: { id }, select: bookingSelect });
}

export async function listCustomerBookings(
  customerUserId: string,
  opts: { limit: number; offset: number },
) {
  const where = { customerUserId };
  const [bookings, totalCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: opts.offset,
      take: opts.limit,
      select: bookingSelect,
    }),
    prisma.booking.count({ where }),
  ]);
  return { bookings, totalCount };
}

/** Artist inbox: only paid bookings (unpaid / order-created stay customer-only). */
export async function listArtistBookings(
  artistProfileId: string,
  opts: { limit: number; offset: number; status?: BookingStatus },
) {
  const where = {
    artistProfileId,
    paymentStatus: PAYMENT_STATUS.PAID,
    ...(opts.status ? { status: opts.status } : {}),
  };
  const [bookings, totalCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: opts.offset,
      take: opts.limit,
      select: bookingSelect,
    }),
    prisma.booking.count({ where }),
  ]);
  return { bookings, totalCount };
}

export function updateBookingStatus(id: string, status: BookingStatus) {
  return prisma.booking.update({
    where: { id },
    data: { status },
    select: bookingSelect,
  });
}

export function updateBookingFields(
  id: string,
  data: Prisma.BookingUpdateInput,
) {
  return prisma.booking.update({
    where: { id },
    data,
    select: bookingSelect,
  });
}

/** Mint OTPs for paid bookings created before the OTP flow shipped. */
export async function ensureBookingCodes(id: string) {
  const row = await prisma.booking.findUnique({
    where: { id },
    select: { arrivalCode: true, closingCode: true, paymentStatus: true },
  });
  if (!row || row.paymentStatus !== PAYMENT_STATUS.PAID) return findBookingById(id);
  if (
    row.arrivalCode &&
    row.closingCode &&
    row.arrivalCode.length === 6 &&
    row.closingCode.length === 6
  ) {
    return findBookingById(id);
  }

  const codes = newBookingCodes();
  return prisma.booking.update({
    where: { id },
    data: {
      arrivalCode: row.arrivalCode || codes.arrival,
      closingCode: row.closingCode || codes.closing,
    },
    select: bookingSelect,
  });
}

/** Active bookings already holding this artist+date (no double-book same day). */
export function countBlockingBookingsForDate(
  artistProfileId: string,
  eventDate: Date,
  excludeBookingId?: string,
) {
  return prisma.booking.count({
    where: {
      artistProfileId,
      eventDate,
      status: {
        in: [
          "pending",
          "accepted",
          "arrived",
          "arrival_confirmed",
          "performing",
          "finished",
        ],
      },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
}
