import { PrismaClient } from "@prisma/client";
import { seedAdminUser, seedMasterData } from "./seed-lib";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding master data...");
  await seedMasterData(prisma);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? "Administrator";

  if (adminEmail && adminPassword) {
    console.log("Seeding initial admin user...");
    await seedAdminUser(prisma, {
      email: adminEmail,
      password: adminPassword,
      name: adminName,
    });
  } else {
    console.log("Skipping initial admin user. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one during seed.");
  }

  console.log("Master seed complete.");
}

main()
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
