import { PrismaClient } from "@prisma/client";
import { seedAdminUser, seedDefaultDatevProfile, seedDemoUser, seedMasterData } from "./seed-lib";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding optional demo data...");

  const { purposeMap, categoryMap, countryMap } = await seedMasterData(prisma);

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@belegbox.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  const adminName = process.env.ADMIN_NAME ?? "Administrator";
  const admin = await seedAdminUser(prisma, {
    email: adminEmail,
    password: adminPassword,
    name: adminName,
  });

  const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@belegbox.local";
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "demo1234";
  const demoName = process.env.DEMO_USER_NAME ?? "Demo Benutzer";
  const demoPin = process.env.DEMO_USER_PIN ?? "1234";
  const demoUser = await seedDemoUser(prisma, {
    email: demoEmail,
    password: demoPassword,
    name: demoName,
    pin: demoPin,
  });

  await seedDefaultDatevProfile(prisma, adminEmail);

  const existingCount = await prisma.receipt.count();
  if (existingCount > 0) {
    console.log(`Skipping demo receipts (${existingCount} receipts already exist).`);
    return;
  }

  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);

  await prisma.receipt.create({
    data: {
      userId: demoUser.id,
      date: daysAgo(3),
      supplier: "ARAL Tankstelle",
      amount: 67.42,
      currency: "EUR",
      amountEur: 67.42,
      purposeId: purposeMap["Tanken"],
      categoryId: categoryMap["EC-Karte"],
      countryId: countryMap.DE,
      sendStatus: "OPEN",
      remark: "Dienstfahrt Berlin-Hamburg",
    },
  });

  await prisma.receipt.create({
    data: {
      userId: demoUser.id,
      date: daysAgo(7),
      supplier: "Putarina Srbija",
      amount: 1170.0,
      currency: "RSD",
      exchangeRate: 117.0,
      exchangeRateDate: daysAgo(7),
      amountEur: 10.0,
      purposeId: purposeMap.Maut,
      categoryId: categoryMap.Kreditkarte,
      countryId: countryMap.RS,
      sendStatus: "OPEN",
      remark: "Autobahngebuehr Belgrad-Nis",
    },
  });

  const hospitalityReceipt = await prisma.receipt.create({
    data: {
      userId: admin.id,
      date: daysAgo(1),
      supplier: "Restaurant Adria",
      amount: 186.5,
      currency: "EUR",
      amountEur: 186.5,
      purposeId: purposeMap.Bewirtung,
      categoryId: categoryMap.Kreditkarte,
      countryId: countryMap.DE,
      sendStatus: "OPEN",
      remark: "Projektabschluss Q1",
    },
  });

  await prisma.hospitality.create({
    data: {
      receiptId: hospitalityReceipt.id,
      occasion: "Projektabschluss-Dinner Q1 2026",
      guests: "Hr. Mueller (Kunde), Fr. Schmidt (PM), Hr. Weber (Entwicklung)",
      location: "Restaurant Adria, Friedrichstrasse 42, Berlin",
    },
  });

  const failedReceipt = await prisma.receipt.create({
    data: {
      userId: demoUser.id,
      date: daysAgo(5),
      supplier: "Bueromarkt Schreiber",
      amount: 43.9,
      currency: "EUR",
      amountEur: 43.9,
      purposeId: purposeMap.Buero,
      categoryId: categoryMap.Kasse,
      countryId: countryMap.DE,
      sendStatus: "FAILED",
      sendStatusUpdatedAt: daysAgo(4),
      remark: "Druckerpapier und Toner",
    },
  });

  await prisma.sendLog.create({
    data: {
      receiptId: failedReceipt.id,
      toAddress: "datev@steuerberater.example",
      success: false,
      errorMessage: "SMTP-Verbindung fehlgeschlagen: ECONNREFUSED 127.0.0.1:587",
      sentAt: daysAgo(4),
    },
  });

  const sentReceipt = await prisma.receipt.create({
    data: {
      userId: admin.id,
      date: daysAgo(10),
      supplier: "DB Fernverkehr",
      amount: 89.9,
      currency: "EUR",
      amountEur: 89.9,
      purposeId: purposeMap.Unterkunft,
      categoryId: categoryMap.Kreditkarte,
      countryId: countryMap.DE,
      sendStatus: "SENT",
      sendStatusUpdatedAt: daysAgo(9),
    },
  });

  await prisma.sendLog.create({
    data: {
      receiptId: sentReceipt.id,
      toAddress: "datev@steuerberater.example",
      success: true,
      messageId: "<demo-msg-001@belegbox.local>",
      sentAt: daysAgo(9),
    },
  });

  console.log("Optional demo seed complete.");
}

main()
  .catch(async (error) => {
    console.error("Demo seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
