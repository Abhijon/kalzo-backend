import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "./apiError";

export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path.join(".");
      const missing = issue?.code === "invalid_type" && field && req.body?.[field] === undefined;
      throw new ApiError(400, missing ? `${field} is required` : (issue?.message ?? "Invalid request body"));
    }
    req.body = result.data;
    next();
  };
}
