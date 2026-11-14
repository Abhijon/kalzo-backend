import type { RoleName } from "./roles";

type UserWithRole = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: { name: string };
};

export function toPublicUser({ role, ...user }: UserWithRole) {
  return { ...user, role: role.name as RoleName };
}
