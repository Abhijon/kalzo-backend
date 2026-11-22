import { prisma } from "../lib/prisma";

export function listArtForms() {
  return prisma.artForm.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, type: true, subtypes: true },
  });
}

export function listLocations() {
  return prisma.locationState.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      cities: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
}
