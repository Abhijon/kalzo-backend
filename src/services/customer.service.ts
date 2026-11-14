import { prisma } from "../lib/prisma";

export type CustomerProfileInput = {
  fullName: string;
  location: string;
  customerType: string;
  reasonForBooking: string;
  businessName?: string;
  mobileNumber: string;
};

export function createCustomer(email: string, passwordHash: string, roleId: string, profile: CustomerProfileInput) {
  return prisma.user.create({
    data: { email, passwordHash, roleId, customerProfile: { create: profile } },
    select: {
      id: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { name: true } },
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
