import type { Request, Response } from "express";
import { z } from "zod";
import * as artistService from "../services/artist.service";
import * as reviewService from "../services/review.service";
import { ApiError } from "../utils/apiError";
import { paginationMeta, parsePagination } from "../utils/pagination";
import { sendSuccess } from "../utils/response";
import { VERIFICATION_STATUS } from "../utils/verification";

const createSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1, "Please write your review.").max(2000),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(12)
    .optional()
    .default([]),
});

/** POST /bookings/:id/review — customer rates a completed booking */
export async function createReview(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid review payload");
  }

  const result = await reviewService.createReview({
    bookingId: String(req.params.id),
    customerUserId: req.user!.id,
    rating: parsed.data.rating,
    body: parsed.data.body,
    tags: parsed.data.tags,
  });

  sendSuccess(
    res,
    {
      message: "Review saved. Thank you.",
      review: result.review,
      avgRating: result.avgRating,
      reviewCount: result.reviewCount,
    },
    201,
  );
}

/** GET /bookings/:id/review — customer or assigned artist */
export async function getBookingReview(req: Request, res: Response) {
  const myArtist = await artistService.findProfileByUserId(req.user!.id);
  const review = await reviewService.getReviewForBooking({
    bookingId: String(req.params.id),
    userId: req.user!.id,
    isCustomer: true,
    artistProfileId: myArtist?.id ?? null,
  });

  sendSuccess(res, {
    review,
    hasReview: Boolean(review),
  });
}

/** GET /artists/:id/reviews — public paginated reviews + rating summary */
export async function listArtistReviews(req: Request, res: Response) {
  const artistId = String(req.params.id);
  const artist = await artistService.findProfileById(artistId);
  if (!artist || artist.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    throw new ApiError(404, "Artist not found");
  }

  const q = parsePagination(req.query);
  const result = await reviewService.listArtistReviews(artistId, {
    limit: q.limit,
    offset: q.offset,
  });

  sendSuccess(res, {
    avgRating: result.avgRating,
    reviewCount: result.reviewCount,
    breakdown: result.breakdown,
    reviews: result.reviews,
    pagination: paginationMeta(result.totalCount, q),
  });
}
