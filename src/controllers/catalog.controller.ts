import type { Request, Response } from "express";
import * as catalogService from "../services/catalog.service";
import { sendSuccess } from "../utils/response";

/** GET /art-forms — public catalog for artist setup + customer filters */
export async function listArtForms(_req: Request, res: Response) {
  const rows = await catalogService.listArtForms();
  sendSuccess(res, {
    artForms: rows.map((r) => ({
      id: r.id,
      type: r.type,
      subtypes: r.subtypes,
    })),
  });
}

/**
 * GET /locations — public catalog for base/current/preferred city + state pickers.
 * Shape matches frontend locations.json: [{ state, cities: string[] }]
 */
export async function listLocations(_req: Request, res: Response) {
  const rows = await catalogService.listLocations();
  sendSuccess(res, {
    locations: rows.map((s) => ({
      id: s.id,
      state: s.name,
      name: s.name,
      cities: s.cities.map((c) => c.name),
    })),
  });
}
