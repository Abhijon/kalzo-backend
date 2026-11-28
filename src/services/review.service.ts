import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { BOOKING_STATUS } from "../utils/bookingStatus";
import { PAYMENT_STATUS } from "../utils/paymentStatus";

const reviewSelect = {
  id: true,
  bookingId: true,
  customerUserId: true,
  artistProfileId: true,
  rating: true,
  body: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  booking: {
    select: {
      eventDate: true,
      note: true,
      customer: {
        select: {
          customerProfile: { select: { fullName: true } },
        },
      },
    },
  },
} as const;

export function normalizeReviewTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = String(raw ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t.slice(0, 40));
    if (out.length >= 12) break;
  }
  return out;
}

export function toReviewDto(row: {
  id: string;
  bookingId: string;
  customerUserId: string;
  artistProfileId: string;
  rating: number;
  body: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  booking?: {
    eventDate: Date;
    note: string | null;
    customer?: { customerProfile?: { fullName: string } | null } | null;
  };
}) {
  const fullName = row.booking?.customer?.customerProfile?.fullName?.trim() || "Patron";
  const parts = fullName.split(/\s+/);
  const who =
    parts.length === 1
      ? parts[0]!.toUpperCase()
      : `${parts[0]!.toUpperCase()} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
  const occasion =
    row.booking?.note?.replace(/^Occasion:\s*/i, "").trim().split("·")[0]?.trim() || "";
  const when = row.createdAt.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const tags = (row.tags ?? [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  return {
    id: row.id,
    bookingId: row.bookingId,
    artistProfileId: row.artistProfileId,
    rating: row.rating,
    body: row.body,
    tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // Shape used by Kalzo profile Reviews tab
    text: row.body,
    stars: "★".repeat(row.rating) + "☆".repeat(Math.max(0, 5 - row.rating)),
    who,
    event: occasion ? occasion.toUpperCase().slice(0, 40) : "",
    when: when.toUpperCase(),
  };
}

async function refreshArtistRating(artistProfileId: string) {
  const agg = await prisma.artistReview.aggregate({
    where: { artistProfileId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const reviewCount = agg._count._all;
  const avgRating = reviewCount === 0 ? 0 : Math.round((agg._avg.rating ?? 0) * 10) / 10;
  await prisma.artistProfile.update({
    where: { id: artistProfileId },
    data: { avgRating, reviewCount },
  });
  return { avgRating, reviewCount };
}

export async function createReview(input: {
  bookingId: string;
  customerUserId: string;
  rating: number;
  body: string;
  tags?: string[];
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      customerUserId: true,
      artistProfileId: true,
      status: true,
      paymentStatus: true,
      review: { select: { id: true } },
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.customerUserId !== input.customerUserId) {
    throw new ApiError(403, "You do not have access to this booking");
  }
  if (booking.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new ApiError(400, "Only paid bookings can be reviewed");
  }
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ApiError(400, "You can review only after the artist completes the job");
  }
  if (booking.review) {
    throw new ApiError(409, "You already reviewed this booking");
  }

  const tags = normalizeReviewTags(input.tags);

  try {
    const created = await prisma.artistReview.create({
      data: {
        bookingId: booking.id,
        customerUserId: input.customerUserId,
        artistProfileId: booking.artistProfileId,
        rating: input.rating,
        body: input.body,
        tags,
      },
      select: reviewSelect,
    });
    const summary = await refreshArtistRating(booking.artistProfileId);
    return { review: toReviewDto(created), ...summary };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") throw new ApiError(409, "You already reviewed this booking");
    throw err;
  }
}

export async function getReviewForBooking(input: {
  bookingId: string;
  userId: string;
  isCustomer: boolean;
  artistProfileId?: string | null;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      customerUserId: true,
      artistProfileId: true,
      review: { select: reviewSelect },
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");

  const isOwnerCustomer = booking.customerUserId === input.userId;
  const isOwnerArtist = input.artistProfileId === booking.artistProfileId;
  if (!isOwnerCustomer && !isOwnerArtist) {
    throw new ApiError(403, "You do not have access to this booking");
  }
  if (!booking.review) return null;
  return toReviewDto(booking.review);
}

export async function listArtistReviews(
  artistProfileId: string,
  opts: { limit: number; offset: number },
) {
  const where = { artistProfileId };
  const [rows, totalCount, grouped] = await Promise.all([
    prisma.artistReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: opts.offset,
      take: opts.limit,
      select: reviewSelect,
    }),
    prisma.artistReview.count({ where }),
    prisma.artistReview.groupBy({
      by: ["rating"],
      where,
      _count: { _all: true },
    }),
  ]);

  const breakdown: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const g of grouped) {
    breakdown[String(g.rating)] = g._count._all;
  }

  const artist = await prisma.artistProfile.findUnique({
    where: { id: artistProfileId },
    select: { avgRating: true, reviewCount: true },
  });

  return {
    reviews: rows.map(toReviewDto),
    totalCount,
    avgRating: Number(artist?.avgRating ?? 0),
    reviewCount: Number(artist?.reviewCount ?? totalCount),
    breakdown,
  };
}
