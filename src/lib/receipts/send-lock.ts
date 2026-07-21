import type { SendStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Idempotenz-/Race-Schutz beim Versand (P1-4).
 *
 * Der Lock wird ueber ein atomares `updateMany` mit `count === 1` als
 * Compare-and-Swap realisiert: Nur genau ein paralleler Request kann den Slot
 * fuer einen Beleg beanspruchen. Ein Stale-Timeout raeumt haengende Locks nach
 * einem Absturz wieder frei.
 */

// Nach dieser Zeit gilt ein Lock als verwaist (z.B. nach Prozessabsturz) und
// darf neu beansprucht werden. Grosszuegiger als der SMTP-Socket-Timeout.
export const SEND_LOCK_TTL_MS = 2 * 60_000;

/**
 * Versucht, den Versand-Slot fuer einen Beleg exklusiv zu beanspruchen.
 * Erfolgreich nur, wenn:
 *  - der Beleg aktuell einen der erlaubten Status hat und
 *  - kein aktiver (nicht-stale) Lock gehalten wird.
 * Gibt true zurueck, wenn dieser Aufruf den Slot beansprucht hat.
 */
export async function claimSendSlot(
  receiptId: string,
  allowedStatuses: SendStatus[],
  now: Date = new Date(),
): Promise<boolean> {
  const staleThreshold = new Date(now.getTime() - SEND_LOCK_TTL_MS);

  const result = await prisma.receipt.updateMany({
    where: {
      id: receiptId,
      sendStatus: { in: allowedStatuses },
      OR: [{ sendLockedAt: null }, { sendLockedAt: { lt: staleThreshold } }],
    },
    data: { sendLockedAt: now },
  });

  return result.count === 1;
}

/** Gibt den Versand-Slot wieder frei (immer im finally aufrufen). */
export async function releaseSendSlot(receiptId: string): Promise<void> {
  await prisma.receipt.updateMany({
    where: { id: receiptId },
    data: { sendLockedAt: null },
  });
}
