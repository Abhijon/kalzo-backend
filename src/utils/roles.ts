export const ROLES = {
  CUSTOMER: "CUSTOMER",
  ARTIST: "ARTIST",
  ADMIN: "ADMIN",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
