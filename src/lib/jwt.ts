import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { RoleName } from "../utils/roles";

export type TokenPayload = { sub: string; email: string; role: RoleName };

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
