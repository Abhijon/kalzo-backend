import { Router } from "express";
import { z } from "zod";
import * as customerController from "../../controllers/customer.controller";
import { validate } from "../../utils/validate";

const router = Router();

const customerSignupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  location: z.string().trim().min(1, "Location is required"),
  customerType: z.string().trim().min(1, "Please select who you are"),
  reasonForBooking: z.string().trim().min(1, "Reason for booking is required"),
  businessName: z.string().trim().max(120).optional(),
  email: z.email(),
  mobileNumber: z.string().regex(/^\d{10}$/, "Mobile number must be 10 digits"),
});

/**
 * @swagger
 * /customer-signup:
 *   post:
 *     tags: [Customer]
 *     summary: Create a customer account (no password; verify OTP next)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CustomerSignupRequest' }
 *     responses:
 *       201:
 *         description: Customer account created; call /verify-otp with the static OTP
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CustomerSignupResponse' }
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Email already exists — use login or a different email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/customer-signup", validate(customerSignupSchema), customerController.signup);

export default router;
