import type { Request, Response } from "express";
import * as artistService from "../services/artist.service";
import * as availabilityService from "../services/availability.service";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/response";
import { VERIFICATION_STATUS } from "../utils/verification";

async function requireMyArtistProfile(userId: string) {
  return artistService.ensureProfileByUserId(userId);
}

/** GET /artist/availability — Mon–Sun + isActive */
export async function listMyAvailability(req: Request, res: Response) {
  const profile = await requireMyArtistProfile(req.user!.id);
  const days = await availabilityService.listWeekdaysForArtist(profile.id);
  sendSuccess(res, { days });
}

/** PATCH /artist/availability/days — { weekday|day, isActive } */
export async function setDayActive(req: Request, res: Response) {
  const profile = await requireMyArtistProfile(req.user!.id);
  const weekday = availabilityService.parseWeekday(req.body.weekday ?? req.body.day);
  if (weekday == null) {
    throw new ApiError(400, 'weekday must be 0–6 or a day name like "monday"');
  }
  if (typeof req.body.isActive !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean");
  }

  const day = await availabilityService.setWeekdayActive(profile.id, weekday, req.body.isActive);
  sendSuccess(res, { day });
}

/** GET /artists/:id/availability — public Mon–Sun for verified artist */
export async function listArtistPublicAvailability(req: Request, res: Response) {
  const artist = await artistService.findProfileById(String(req.params.id));
  if (!artist || artist.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    throw new ApiError(404, "Artist not found");
  }

  const days = await availabilityService.listPublicWeekdays(artist.id);
  sendSuccess(res, { artistId: artist.id, days });
}
