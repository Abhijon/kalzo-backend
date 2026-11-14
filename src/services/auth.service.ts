import { prisma } from "../lib/prisma";

const publicUserFields = {
  id: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
} as const;

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { ...publicUserFields, passwordHash: true },
  });
}

export function findUserWithProfileById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      ...publicUserFields,
      customerProfile: {
        select: {
          id: true,
          fullName: true,
          location: true,
          customerType: true,
          reasonForBooking: true,
          businessName: true,
          mobileNumber: true,
        },
      },
    },
  });
}

export function activateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true },
    select: publicUserFields,
  });
}
