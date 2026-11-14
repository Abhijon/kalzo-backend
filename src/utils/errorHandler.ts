import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./apiError";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
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

  console.error(err);
  res.status(500).json({ success: false, message: "Something went wrong" });
}
