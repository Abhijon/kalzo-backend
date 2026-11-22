import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type ArtFormSeed = { type: string; subtypes: string[] };
type LocationSeed = { name: string; cities: string[] };

async function seedArtForms() {
  const file = path.join(__dirname, "art-forms.seed.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as ArtFormSeed[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    await prisma.artForm.upsert({
      where: { type: row.type },
      create: { type: row.type, subtypes: row.subtypes, sortOrder: i },
      update: { subtypes: row.subtypes, sortOrder: i },
    });
  }
  console.log(`Seeded ${rows.length} art forms`);
}

async function seedLocations() {
  const file = path.join(__dirname, "locations.seed.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as LocationSeed[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const state = await prisma.locationState.upsert({
      where: { name: row.name },
      create: { name: row.name, sortOrder: i },
      update: { sortOrder: i },
    });

    for (const city of row.cities) {
      await prisma.locationCity.upsert({
        where: { stateId_name: { stateId: state.id, name: city } },
        create: { name: city, stateId: state.id },
        update: {},
      });
    }
  }
  console.log(`Seeded ${rows.length} location states`);
}

async function main() {
  await seedArtForms();
  await seedLocations();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
