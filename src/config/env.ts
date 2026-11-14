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
      z.string().regex(/^\d{4}$/, "STATIC_OTP must be 4 digits").optional(),
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
