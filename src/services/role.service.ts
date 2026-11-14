import { prisma } from "../lib/prisma";

export function findRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name } });
}

export async function findUserRoleName(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } } },
  });
  return user?.role.name ?? null;
}
