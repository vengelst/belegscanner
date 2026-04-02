import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export const PURPOSES = [
  { name: "Buero", isHospitality: false },
  { name: "Ware", isHospitality: false },
  { name: "Asset", isHospitality: false },
  { name: "Tanken", isHospitality: false },
  { name: "Unterkunft", isHospitality: false },
  { name: "Bewirtung", isHospitality: true },
  { name: "Material", isHospitality: false },
  { name: "Parken", isHospitality: false },
  { name: "Maut", isHospitality: false },
  { name: "Sonstiges", isHospitality: false },
];

export const CATEGORIES = [
  "Kasse",
  "Kreditkarte",
  "EC-Karte",
  "Bank",
  "privat ausgelegt",
];

export const COUNTRIES = [
  { code: "DE", name: "Deutschland", currencyCode: "EUR" },
  { code: "AT", name: "Oesterreich", currencyCode: "EUR" },
  { code: "CH", name: "Schweiz", currencyCode: "CHF" },
  { code: "RS", name: "Serbien", currencyCode: "RSD" },
  { code: "MK", name: "Nordmazedonien", currencyCode: "MKD" },
  { code: "HR", name: "Kroatien", currencyCode: "EUR" },
];

export const VEHICLES = [
  { plate: "B-BB 1234", description: "Firmenwagen" },
  { plate: "M-XX 5678", description: "Poolfahrzeug" },
];

export type SeedMaps = {
  purposeMap: Record<string, string>;
  categoryMap: Record<string, string>;
  countryMap: Record<string, string>;
};

export async function seedMasterData(prisma: PrismaClient): Promise<SeedMaps> {
  const purposeMap: Record<string, string> = {};
  for (const [index, purpose] of PURPOSES.entries()) {
    const p = await prisma.purpose.upsert({
      where: { name: purpose.name },
      update: { sortOrder: index, isHospitality: purpose.isHospitality, active: true },
      create: { ...purpose, sortOrder: index },
    });
    purposeMap[purpose.name] = p.id;
  }

  const categoryMap: Record<string, string> = {};
  for (const [index, name] of CATEGORIES.entries()) {
    const c = await prisma.category.upsert({
      where: { name },
      update: { sortOrder: index, active: true },
      create: { name, sortOrder: index },
    });
    categoryMap[name] = c.id;
  }

  const countryMap: Record<string, string> = {};
  for (const [index, country] of COUNTRIES.entries()) {
    const c = await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name, currencyCode: country.currencyCode, sortOrder: index, active: true },
      create: { ...country, sortOrder: index },
    });
    countryMap[country.code] = c.id;
  }

  for (const [index, vehicle] of VEHICLES.entries()) {
    await prisma.vehicle.upsert({
      where: { plate: vehicle.plate },
      update: { description: vehicle.description, sortOrder: index, active: true },
      create: { ...vehicle, sortOrder: index },
    });
  }

  return { purposeMap, categoryMap, countryMap };
}

export async function seedAdminUser(
  prisma: PrismaClient,
  { email, password, name }: { email: string; password: string; name: string },
) {
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.upsert({
    where: { email },
    update: { name, role: Role.ADMIN, active: true, passwordHash },
    create: { email, name, role: Role.ADMIN, active: true, passwordHash },
  });
}

export async function seedDemoUser(
  prisma: PrismaClient,
  { email, password, name, pin }: { email: string; password: string; name: string; pin: string },
) {
  const passwordHash = await bcrypt.hash(password, 12);
  const pinHash = await bcrypt.hash(pin, 12);

  return prisma.user.upsert({
    where: { email },
    update: { name, role: Role.USER, active: true, passwordHash, pinHash },
    create: { email, name, role: Role.USER, active: true, passwordHash, pinHash },
  });
}

export async function seedDefaultDatevProfile(prisma: PrismaClient, senderAddress: string) {
  return prisma.datevProfile.upsert({
    where: { name: "Standard" },
    update: {},
    create: {
      name: "Standard",
      datevAddress: "datev@steuerberater.example",
      senderAddress,
      subjectTemplate: "Beleg {date} - {supplier} - {amount} {currency}",
      bodyTemplate: `Beleg vom {date}

Lieferant: {supplier}
Betrag: {amount} {currency}
Zweck: {purpose}
Kategorie: {category}
Benutzer: {user}

{remark}

-- BelegBox`,
      isDefault: true,
      active: true,
    },
  });
}
