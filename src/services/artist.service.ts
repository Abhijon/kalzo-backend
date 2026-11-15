import { prisma } from "../lib/prisma";

export type ArtistProfileInput = {
  mobileNumber: string;
};

const artistProfileSelect = {
  id: true,
  mobileNumber: true,
} as const;

export function createArtist(email: string, roleId: string, profile: ArtistProfileInput) {
  return prisma.user.create({
    data: { email, roleId, artistProfile: { create: profile } },
    select: {
      id: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { name: true } },
      artistProfile: { select: artistProfileSelect },
    },
  });
}
