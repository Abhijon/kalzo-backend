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
  })
  .refine((e) => !e.STATIC_OTP_ENABLED || e.STATIC_OTP, {
    message: "STATIC_OTP is required when STATIC_OTP_ENABLED=true",
    path: ["STATIC_OTP"],
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.STATIC_OTP_ENABLED && env.NODE_ENV === "production") {
  console.warn("[security] STATIC_OTP_ENABLED is true in production: anyone can verify any account with the static OTP.");
}
