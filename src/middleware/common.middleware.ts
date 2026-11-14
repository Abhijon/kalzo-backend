import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";
import * as roleService from "../services/role.service";
import { ApiError } from "../utils/apiError";
import type { RoleName } from "../utils/roles";

export type AuthUser = { id: string; email: string; role: RoleName };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Missing bearer token");

  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
  next();
}

// The role is re-read from the roles table so promotions and demotions apply without a new token.
export function authorize(...roles: RoleName[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, "Missing bearer token");

    const roleName = await roleService.findUserRoleName(req.user.id);
    if (!roleName) throw new ApiError(401, "User no longer exists");
    if (!roles.includes(roleName as RoleName)) {
      throw new ApiError(403, "You do not have access to this resource");
    }

    req.user.role = roleName as RoleName;
    next();
  };
}
