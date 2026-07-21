import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveOriginalFile, deleteReceiptFiles, receiptFileCreate, $transaction } = vi.hoisted(() => {
  const receiptFileCreate = vi.fn();
  return {
    saveOriginalFile: vi.fn(),
    deleteReceiptFiles: vi.fn(),
    receiptFileCreate,
    // Fake interaktive Transaktion: fuehrt den Callback aus; wirft der Callback,
    // lehnt $transaction ab (entspricht dem Rollback-Verhalten von Prisma).
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ receiptFile: { create: receiptFileCreate } }),
    ),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction } }));
vi.mock("@/lib/storage", () => ({ saveOriginalFile, deleteReceiptFiles }));

import { createReceiptWithFile } from "@/lib/receipts/persist-with-file";

const fileInput = { buffer: Buffer.from("x"), mimeType: "image/jpeg", originalName: "beleg.jpg" };

beforeEach(() => {
  vi.clearAllMocks();
  saveOriginalFile.mockResolvedValue({
    mimeType: "image/jpeg",
    filename: "beleg.jpg",
    storagePath: "receipts/r1/original.jpg",
    sizeBytes: 1,
  });
});

describe("createReceiptWithFile – Atomizitaet (P1-3)", () => {
  it("legt Beleg + ReceiptFile an und raeumt bei Erfolg nichts auf", async () => {
    const createReceipt = vi.fn().mockResolvedValue({ id: "r1" });

    const receipt = await createReceiptWithFile({ ...fileInput, createReceipt });

    expect(receipt.id).toBe("r1");
    expect(saveOriginalFile).toHaveBeenCalledOnce();
    expect(receiptFileCreate).toHaveBeenCalledOnce();
    expect(deleteReceiptFiles).not.toHaveBeenCalled();
  });

  it("simulierter Upload-Fehler: kein ReceiptFile, Rollback, kein haengender Beleg", async () => {
    const createReceipt = vi.fn().mockResolvedValue({ id: "r1" });
    saveOriginalFile.mockRejectedValueOnce(new Error("disk full"));

    await expect(createReceiptWithFile({ ...fileInput, createReceipt })).rejects.toThrow("disk full");

    // ReceiptFile wurde nie geschrieben (Transaktion rollt zurueck).
    expect(receiptFileCreate).not.toHaveBeenCalled();
    // Beleg wurde zwar in der Transaktion begonnen, aber durch Rollback verworfen;
    // die evtl. geschriebene Datei wird best-effort entfernt.
    expect(deleteReceiptFiles).toHaveBeenCalledWith("r1");
  });

  it("DB-Fehler nach Dateispeicherung: verwaiste Datei wird entfernt", async () => {
    const createReceipt = vi.fn().mockResolvedValue({ id: "r1" });
    receiptFileCreate.mockRejectedValueOnce(new Error("db constraint"));

    await expect(createReceiptWithFile({ ...fileInput, createReceipt })).rejects.toThrow("db constraint");

    expect(saveOriginalFile).toHaveBeenCalledOnce();
    expect(deleteReceiptFiles).toHaveBeenCalledWith("r1");
  });

  it("Fehler vor Beleganlage: keine Cleanup-noetig, kein Aufruf von deleteReceiptFiles", async () => {
    const createReceipt = vi.fn().mockRejectedValue(new Error("validation"));

    await expect(createReceiptWithFile({ ...fileInput, createReceipt })).rejects.toThrow("validation");

    expect(saveOriginalFile).not.toHaveBeenCalled();
    expect(deleteReceiptFiles).not.toHaveBeenCalled();
  });
});
