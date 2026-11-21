import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./apiError";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  if (err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Request body is not valid JSON" });
    return;
  }

  // Race: two signups with the same email can hit the unique index.
  if (isPrismaUniqueViolation(err)) {
    const target = (err as { meta?: { target?: string[] | string } }).meta?.target;
    const fields = Array.isArray(target) ? target : target ? [target] : [];
    if (fields.includes("email") || fields.length === 0) {
      res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please log in, or use a different email to sign up.",
      });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ success: false, message: "Something went wrong" });
}
