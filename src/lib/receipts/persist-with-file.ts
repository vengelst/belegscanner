import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveOriginalFile, deleteReceiptFiles } from "@/lib/storage";

/**
 * Atomare Persistenz von Beleg + Originaldatei (P1-3).
 *
 * Garantien:
 *  - Es entsteht nie ein dauerhafter Beleg ohne zugehoerigen ReceiptFile-Eintrag:
 *    Beleg-Anlage, Dateispeicherung und ReceiptFile-Anlage laufen in EINER
 *    Prisma-Transaktion. Schlaegt die Dateispeicherung (Upload) fehl, wird die
 *    komplette Transaktion zurueckgerollt – der Beleg wird nicht angelegt.
 *  - Keine verwaisten Dateien: Falls die Transaktion nach dem Schreiben der
 *    Datei fehlschlaegt (DB-Rollback), wird die bereits geschriebene Datei
 *    best-effort wieder entfernt.
 */
export async function createReceiptWithFile(params: {
  createReceipt: (tx: Prisma.TransactionClient) => Promise<{ id: string }>;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<{ id: string }> {
  const { createReceipt, buffer, mimeType, originalName } = params;

  let createdReceiptId: string | null = null;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const receipt = await createReceipt(tx);
        createdReceiptId = receipt.id;

        const stored = await saveOriginalFile(receipt.id, buffer, mimeType, originalName);

        await tx.receiptFile.create({
          data: {
            receiptId: receipt.id,
            type: "ORIGINAL",
            mimeType: stored.mimeType,
            filename: stored.filename,
            storagePath: stored.storagePath,
            sizeBytes: stored.sizeBytes,
          },
        });

        return receipt;
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    // DB wurde durch den Transaktions-Rollback bereits sauber gehalten. Jetzt
    // noch eine ggf. bereits geschriebene physische Datei entfernen.
    if (createdReceiptId) {
      await deleteReceiptFiles(createdReceiptId);
    }
    throw error;
  }
}
