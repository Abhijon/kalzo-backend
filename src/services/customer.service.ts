import { prisma } from "../lib/prisma";

export type CustomerProfileInput = {
  fullName: string;
  location: string;
  customerType: string;
  reasonForBooking: string;
  businessName?: string;
  mobileNumber: string;
};

const customerProfileSelect = {
  id: true,
  fullName: true,
  location: true,
  customerType: true,
  reasonForBooking: true,
  businessName: true,
  mobileNumber: true,
} as const;

export function createCustomer(email: string, roleId: string, profile: CustomerProfileInput) {
  return prisma.user.create({
    data: { email, roleId, customerProfile: { create: profile } },
    select: {
      id: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { name: true } },
      customerProfile: { select: customerProfileSelect },
    },
  });
}
