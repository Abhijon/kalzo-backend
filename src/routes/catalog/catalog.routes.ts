import { Router } from "express";
import * as catalogController from "../../controllers/catalog.controller";

const router = Router();

/**
 * @swagger
 * /art-forms:
 *   get:
 *     tags: [Catalog]
 *     summary: List art form types and subtypes (public)
 *     description: Seeded from artist onboarding — use for discipline/subcategory dropdowns and filters.
 *     responses:
 *       200:
 *         description: Art forms catalog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     artForms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           type: { type: string, example: Musicians }
 *                           subtypes:
 *                             type: array
 *                             items: { type: string }
 *                             example: ["Guitarist", "Tabla player"]
 */
router.get("/art-forms", catalogController.listArtForms);

/**
 * @swagger
 * /locations:
 *   get:
 *     tags: [Catalog]
 *     summary: List Indian states and cities (public)
 *     description: Use for base city, current city, preferred cities, and customer location filters.
 *     responses:
 *       200:
 *         description: Locations catalog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           state: { type: string, example: Maharashtra }
 *                           name: { type: string, example: Maharashtra }
 *                           cities:
 *                             type: array
 *                             items: { type: string }
 *                             example: ["Mumbai", "Pune"]
 */
router.get("/locations", catalogController.listLocations);

export default router;
