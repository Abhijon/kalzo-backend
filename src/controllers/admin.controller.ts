import type { Request, Response } from "express";
import * as artistService from "../services/artist.service";
import * as bookingService from "../services/booking.service";
import { toFlatArtist } from "../utils/artistResponse";
import { ApiError } from "../utils/apiError";
import { BOOKING_STATUS } from "../utils/bookingStatus";
import { toBookingDto } from "../utils/bookingResponse";
import { paginationMeta, parsePagination } from "../utils/pagination";
import { sendSuccess } from "../utils/response";
import { assertKycCompleted } from "../utils/kyc";
import { VERIFICATION_STATUS } from "../utils/verification";

/** GET /admin/artists?page=1&limit=10 */
export async function listArtists(req: Request, res: Response) {
  const q = parsePagination(req.query);
  const { artists, totalCount } = await artistService.listProfiles({
    limit: q.limit,
    offset: q.offset,
  });

  sendSuccess(res, {
    artists: artists.map(toFlatArtist),
    pagination: paginationMeta(totalCount, q),
  });
}

function artistId(req: Request): string {
  return String(req.params.id);
}

/** GET /admin/artists/:id */
export async function getArtist(req: Request, res: Response) {
  const artist = await artistService.findProfileById(artistId(req));
  if (!artist) throw new ApiError(404, "Artist profile not found");
  sendSuccess(res, { artist: toFlatArtist(artist) });
}

/** PATCH /admin/artists/:id/verify */
export async function verifyArtist(req: Request, res: Response) {
  const existing = await artistService.findProfileById(artistId(req));
  if (!existing) throw new ApiError(404, "Artist profile not found");
  if (existing.verificationStatus === VERIFICATION_STATUS.VERIFIED) {
    throw new ApiError(400, "Artist is already verified");
  }
  assertKycCompleted(existing.kycStatus);

  const artist = await artistService.verifyProfileById(existing.id);
  sendSuccess(res, {
    message: "Artist verified.",
    artist: toFlatArtist(artist),
  });
}

/** PATCH /admin/artists/:id/reject — reason/comment required */
export async function rejectArtist(req: Request, res: Response) {
  const existing = await artistService.findProfileById(artistId(req));
  if (!existing) throw new ApiError(404, "Artist profile not found");

  const reason = String(req.body.reason ?? "").trim();
  if (!reason) throw new ApiError(400, "A rejection comment is required");

  const artist = await artistService.rejectProfileById(existing.id, reason);
  sendSuccess(res, {
    message: "Artist rejected.",
    artist: toFlatArtist(artist),
  });
}

/**
 * POST /admin/bookings/:id/release-payout
 * Manual payout release after closing OTP — does not claim a bank transfer succeeded.
 */
export async function releaseBookingPayout(req: Request, res: Response) {
  const booking = await bookingService.findBookingById(String(req.params.id));
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ApiError(400, "Only completed bookings can be marked for payout release");
  }
  if (booking.payoutStatus === "released") {
    sendSuccess(res, {
      message: "Payout already marked released.",
      booking: toBookingDto(booking, "admin"),
    });
    return;
  }

  const updated = await bookingService.updateBookingFields(booking.id, {
    payoutStatus: "released",
  });
  sendSuccess(res, {
    message: "Payout marked released for admin settlement tracking.",
    booking: toBookingDto(updated, "admin"),
  });
}
