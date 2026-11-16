import type { Request, Response } from "express";
import * as artistService from "../services/artist.service";
import { toFlatArtist } from "../utils/artistResponse";
import { ApiError } from "../utils/apiError";
import { paginationMeta, parsePagination } from "../utils/pagination";
import { sendSuccess } from "../utils/response";
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
