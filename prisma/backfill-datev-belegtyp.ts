/**
 * Backfill fuer den DATEV-Belegtyp.
 *
 * Die Migration 20260807100000_add_datev_belegtyp enthaelt denselben Backfill.
 * Dieses Skript ist fuer Installationen gedacht, deren Schema per `prisma db push`
 * synchronisiert wird — dabei laufen Migrations-SQL-Dateien nicht mit.
 *
 * Idempotent: setzt nur Belege ohne Belegtyp und legt fehlende Rechnungseingangs-
 * Adressen an. Aufruf: npx tsx prisma/backfill-datev-belegtyp.ts
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_COMPANY_CARD_LAST_DIGITS, suggestDatevBelegtyp } from "../src/lib/datev/belegtyp";

const prisma = new PrismaClient();

/** Liest ein Textfeld aus den gespeicherten KI-Daten (aiStructuredData.extracted). */
function extractedString(structuredData: unknown, field: string): string | null {
  if (!structuredData || typeof structuredData !== "object") return null;
  const extracted = (structuredData as Record<string, unknown>).extracted;
  if (!extracted || typeof extracted !== "object") return null;
  const value = (extracted as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

async function main() {
  const organization = await prisma.organizationProfile.findUnique({
    where: { id: "default" },
    select: { companyCardLastDigits: true },
  });
  const companyCardLastDigits = organization?.companyCardLastDigits ?? DEFAULT_COMPANY_CARD_LAST_DIGITS;

  const receipts = await prisma.receipt.findMany({
    where: { datevBelegtyp: null },
    select: { id: true, partyRole: true, aiDocumentType: true, aiStructuredData: true },
  });

  for (const receipt of receipts) {
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        datevBelegtyp: suggestDatevBelegtyp({
          partyRole: receipt.partyRole,
          paymentMethod: extractedString(receipt.aiStructuredData, "paymentMethod"),
          cardLastDigits: extractedString(receipt.aiStructuredData, "cardLastDigits"),
          documentType: receipt.aiDocumentType,
          companyCardLastDigits,
        }),
      },
    });
  }

  console.log(`Belegtyp gesetzt fuer ${receipts.length} Beleg(e).`);

  // Bestehende Standard-Adresse als Upload-Mail fuer Rechnungseingang uebernehmen.
  const profiles = await prisma.datevProfile.findMany({
    select: { id: true, datevAddress: true, belegtypAddresses: { select: { belegtyp: true } } },
  });

  let created = 0;
  for (const profile of profiles) {
    const hasEntry = profile.belegtypAddresses.some((a) => a.belegtyp === "RECHNUNGSEINGANG");
    if (hasEntry || !profile.datevAddress.trim()) continue;

    await prisma.datevBelegtypAddress.create({
      data: {
        profileId: profile.id,
        belegtyp: "RECHNUNGSEINGANG",
        datevAddress: profile.datevAddress,
      },
    });
    created += 1;
  }

  console.log(`Upload-Mail-Adresse "Rechnungseingang" ergaenzt fuer ${created} Profil(e).`);
}

main()
  .catch(async (error) => {
    console.error("Backfill fehlgeschlagen:", error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
