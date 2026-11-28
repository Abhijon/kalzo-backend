import { publicUrl } from "../services/media.service";
import { formatDateOnly, weekdayFromDate, weekdayName } from "./weekdays";

type BookingRow = {
  id: string;
  customerUserId: string;
  artistProfileId: string;
  eventDate: Date;
  address: string;
  guests: string | null;
  note: string | null;
  amountInr: number;
  status: string;
  paymentStatus: string;
  paymentIdempotencyKey?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  review?: {
    id: string;
    rating: number;
    body: string;
    tags: string[];
    createdAt: Date;
  } | null;
  artist: {
    id: string;
    stageName: string | null;
    discipline: string | null;
    subcategory: string | null;
    photoPath: string | null;
    rateInr: number | null;
    baseCity: string | null;
    user: { id: string; email: string };
  };
  customer: {
    id: string;
    email: string;
    customerProfile: {
      fullName: string;
      mobileNumber: string;
      location: string;
    } | null;
  };
};

export function toBookingDto(row: BookingRow) {
  const weekday = weekdayFromDate(row.eventDate);
  return {
    id: row.id,
    customerUserId: row.customerUserId,
    artistProfileId: row.artistProfileId,
    eventDate: formatDateOnly(row.eventDate),
    weekday,
    day: weekdayName(weekday),
    address: row.address,
    guests: row.guests,
    note: row.note,
    amountInr: row.amountInr,
    status: row.status,
    paymentStatus: row.paymentStatus,
    razorpayOrderId: row.razorpayOrderId ?? null,
    razorpayPaymentId: row.razorpayPaymentId ?? null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    review: row.review
      ? {
          id: row.review.id,
          rating: row.review.rating,
          body: row.review.body,
          tags: row.review.tags ?? [],
          createdAt: row.review.createdAt.toISOString(),
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    artist: {
      id: row.artist.id,
      stageName: row.artist.stageName,
      discipline: row.artist.discipline,
      subcategory: row.artist.subcategory,
      rateInr: row.artist.rateInr,
      baseCity: row.artist.baseCity,
      photoUrl: row.artist.photoPath ? publicUrl(row.artist.photoPath) : null,
      email: row.artist.user.email,
    },
    customer: {
      id: row.customer.id,
      email: row.customer.email,
      fullName: row.customer.customerProfile?.fullName ?? null,
      mobileNumber: row.customer.customerProfile?.mobileNumber ?? null,
      location: row.customer.customerProfile?.location ?? null,
    },
  };
}
