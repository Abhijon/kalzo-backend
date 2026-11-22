import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const bookingSelect = {
  id: true,
  customerUserId: true,
  artistProfileId: true,
  eventDate: true,
  address: true,
  guests: true,
  note: true,
  amountInr: true,
  status: true,
  createdAt: true,
  updatedAt: true,
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

export async function listArtistBookings(
  artistProfileId: string,
  opts: { limit: number; offset: number; status?: BookingStatus },
) {
  const where = {
    artistProfileId,
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
      status: { in: ["pending", "accepted", "job_started"] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
}
