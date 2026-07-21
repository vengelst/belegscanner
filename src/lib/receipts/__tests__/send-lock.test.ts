import { beforeEach, describe, expect, it, vi } from "vitest";

type ReceiptRow = { id: string; sendStatus: string; sendLockedAt: Date | null };

const { store, updateMany } = vi.hoisted(() => {
  const store = new Map<string, { id: string; sendStatus: string; sendLockedAt: Date | null }>();

  // Minimaler, aber verhaltensgetreuer updateMany-Mock mit CAS-Semantik.
  const updateMany = vi.fn(
    async (args: {
      where: {
        id: string;
        sendStatus?: { in: string[] };
        OR?: Array<{ sendLockedAt: null } | { sendLockedAt: { lt: Date } }>;
      };
      data: { sendLockedAt: Date | null };
    }) => {
      const row = store.get(args.where.id);
      if (!row) return { count: 0 };

      if (args.where.sendStatus && !args.where.sendStatus.in.includes(row.sendStatus)) {
        return { count: 0 };
      }

      if (args.where.OR) {
        const matchesLock = args.where.OR.some((cond) => {
          if ("sendLockedAt" in cond && cond.sendLockedAt === null) {
            return row.sendLockedAt === null;
          }
          if (cond.sendLockedAt && "lt" in cond.sendLockedAt) {
            return row.sendLockedAt !== null && row.sendLockedAt < cond.sendLockedAt.lt;
          }
          return false;
        });
        if (!matchesLock) return { count: 0 };
      }

      row.sendLockedAt = args.data.sendLockedAt;
      return { count: 1 };
    },
  );

  return { store, updateMany };
});

vi.mock("@/lib/prisma", () => ({ prisma: { receipt: { updateMany } } }));

import { claimSendSlot, releaseSendSlot, SEND_LOCK_TTL_MS } from "@/lib/receipts/send-lock";

function seed(row: ReceiptRow) {
  store.clear();
  store.set(row.id, row);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimSendSlot – Idempotenz/Race-Schutz (P1-4)", () => {
  it("beansprucht den Slot genau einmal bei parallelen Requests", async () => {
    seed({ id: "r1", sendStatus: "OPEN", sendLockedAt: null });

    const [a, b] = await Promise.all([
      claimSendSlot("r1", ["OPEN", "READY"]),
      claimSendSlot("r1", ["OPEN", "READY"]),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("verweigert den Claim bei falschem Status", async () => {
    seed({ id: "r1", sendStatus: "SENT", sendLockedAt: null });
    expect(await claimSendSlot("r1", ["OPEN", "READY"])).toBe(false);
  });

  it("verweigert den Claim bei aktivem Lock", async () => {
    seed({ id: "r1", sendStatus: "OPEN", sendLockedAt: new Date() });
    expect(await claimSendSlot("r1", ["OPEN", "READY"])).toBe(false);
  });

  it("erlaubt Re-Claim nach Freigabe", async () => {
    seed({ id: "r1", sendStatus: "OPEN", sendLockedAt: null });
    expect(await claimSendSlot("r1", ["OPEN", "READY"])).toBe(true);
    await releaseSendSlot("r1");
    expect(await claimSendSlot("r1", ["OPEN", "READY"])).toBe(true);
  });

  it("uebernimmt einen verwaisten (stale) Lock", async () => {
    const stale = new Date(Date.now() - SEND_LOCK_TTL_MS - 1_000);
    seed({ id: "r1", sendStatus: "READY", sendLockedAt: stale });
    expect(await claimSendSlot("r1", ["OPEN", "READY"])).toBe(true);
  });

  it("retry-Claim nur aus FAILED/SENT", async () => {
    seed({ id: "r1", sendStatus: "FAILED", sendLockedAt: null });
    expect(await claimSendSlot("r1", ["FAILED", "SENT"])).toBe(true);
  });
});
