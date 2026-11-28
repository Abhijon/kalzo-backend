import "dotenv/config";
import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(8000),
    CORS_ORIGIN: z.string().default("http://localhost:8080"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default("7d"),
    STATIC_OTP_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    STATIC_OTP: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().regex(/^\d{6}$/, "STATIC_OTP must be 6 digits").optional(),
    ),
    // Public base URL of this API (used to build Surepass webhook callback).
    PUBLIC_API_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    // Surepass Digilocker (sandbox: https://sandbox.surepass.app)
    SUREPASS_BASE_URL: z
      .string()
      .url()
      .default("https://sandbox.surepass.app"),
    SUREPASS_API_TOKEN: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    // Where Digilocker redirects the user after completing KYC (frontend URL).
    SUREPASS_REDIRECT_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    // Optional override; defaults to `${PUBLIC_API_URL}/api/v1/webhooks/surepass`.
    SUREPASS_WEBHOOK_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    // AWS S3 (artist media: photo, artPhoto, faceVideo, reels)
    AWS_REGION: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    /** Folder prefix inside the bucket, e.g. artist-profile-images */
    S3_KEY_PREFIX: z.string().trim().min(1).default("artist-profile-images"),
    /**
     * Public base for browser URLs, e.g. https://my-bucket.s3.ap-south-1.amazonaws.com
     * If omitted, built as https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com
     */
    S3_PUBLIC_BASE_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    // Razorpay — optional until you enable payments (test keys first)
    RAZORPAY_KEY_ID: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    RAZORPAY_KEY_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    RAZORPAY_WEBHOOK_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
  })
  .refine((e) => !e.STATIC_OTP_ENABLED || e.STATIC_OTP, {
    message: "STATIC_OTP is required when STATIC_OTP_ENABLED=true",
    path: ["STATIC_OTP"],
  })
  .refine(
    (e) =>
      (!e.RAZORPAY_KEY_ID && !e.RAZORPAY_KEY_SECRET) ||
      (Boolean(e.RAZORPAY_KEY_ID) && Boolean(e.RAZORPAY_KEY_SECRET)),
    {
      message: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be set",
      path: ["RAZORPAY_KEY_SECRET"],
    },
  );

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.STATIC_OTP_ENABLED && env.NODE_ENV === "production") {
  console.warn(
    "[security] STATIC_OTP_ENABLED is true in production: login and booking arrival/closing OTPs all accept the static OTP.",
  );
}
