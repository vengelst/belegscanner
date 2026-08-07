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
import { suggestDatevBelegtyp } from "../src/lib/datev/belegtyp";

const prisma = new PrismaClient();

async function main() {
  const receipts = await prisma.receipt.findMany({
    where: { datevBelegtyp: null },
    select: { id: true, partyRole: true, category: { select: { name: true } } },
  });

  for (const receipt of receipts) {
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        datevBelegtyp: suggestDatevBelegtyp({
          partyRole: receipt.partyRole,
          categoryName: receipt.category.name,
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
