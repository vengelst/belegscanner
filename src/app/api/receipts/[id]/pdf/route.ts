import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { readFile } from "@/lib/storage";
import { appendReceiptMetadataToPdf, generateReceiptPdf } from "@/lib/pdf";
import type { PdfReceiptData } from "@/lib/pdf";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "offen",
  READY: "bereit zum Versand",
  SENT: "gesendet",
  FAILED: "fehlgeschlagen",
  RETRY: "erneut senden",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      country: { select: { name: true, code: true } },
      vehicle: { select: { plate: true } },
      purpose: { select: { name: true } },
      category: { select: { name: true } },
      hospitality: true,
      files: { where: { type: "ORIGINAL" }, take: 1 },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });
  }

  if (session.role !== "ADMIN" && receipt.userId !== session.userId) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  // Load original file. Images are embedded directly; original PDFs are merged
  // into the output PDF and receive the metadata page at the end.
  const originalFile = receipt.files[0] ?? null;
  let originalPdfBuffer: Buffer | null = null;
  let imageBase64: string | null = null;
  let imageMimeType: string | null = null;

  if (originalFile) {
    try {
      const buffer = await readFile(originalFile.storagePath);
      if (originalFile.mimeType.startsWith("image/")) {
        imageBase64 = buffer.toString("base64");
        imageMimeType = originalFile.mimeType;
      } else if (originalFile.mimeType === "application/pdf") {
        originalPdfBuffer = buffer;
      }
    } catch {
      // Continue without original preview if the file cannot be read.
    }
  }

  const fmtDate = (d: Date) => format(d, "dd.MM.yyyy", { locale: de });
  const fmtDateTime = (d: Date) => format(d, "dd.MM.yyyy, HH:mm", { locale: de });
  const fmtAmount = (n: number) =>
    n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const data: PdfReceiptData = {
    id: receipt.id,
    date: fmtDate(receipt.date),
    supplier: receipt.supplier,
    amount: fmtAmount(Number(receipt.amount)),
    currency: receipt.currency,
    exchangeRate: receipt.exchangeRate ? String(Number(receipt.exchangeRate)) : null,
    exchangeRateDate: receipt.exchangeRateDate ? fmtDate(receipt.exchangeRateDate) : null,
    amountEur: fmtAmount(Number(receipt.amountEur)),
    sendStatus: receipt.sendStatus,
    sendStatusLabel: STATUS_LABELS[receipt.sendStatus] ?? receipt.sendStatus,
    sendStatusUpdatedAt: receipt.sendStatusUpdatedAt ? fmtDateTime(receipt.sendStatusUpdatedAt) : null,
    userName: receipt.user.name,
    purposeName: receipt.purpose.name,
    categoryName: receipt.category.name,
    countryName: receipt.country
      ? `${receipt.country.name}${receipt.country.code ? ` (${receipt.country.code})` : ""}`
      : null,
    vehiclePlate: receipt.vehicle?.plate ?? null,
    remark: receipt.remark,
    createdAt: fmtDateTime(receipt.createdAt),
    hospitality: receipt.hospitality
      ? {
          occasion: receipt.hospitality.occasion,
          guests: receipt.hospitality.guests,
          location: receipt.hospitality.location,
        }
      : null,
    imageBase64,
    imageMimeType,
  };

  const pdfBuffer = originalPdfBuffer
    ? await appendReceiptMetadataToPdf(originalPdfBuffer, data)
    : await generateReceiptPdf(data);

  const dateStr = fmtDate(receipt.date).replace(/\./g, "-");
  const supplierStr = (receipt.supplier ?? "Beleg").replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "").slice(0, 30);
  const filename = `Beleg_${dateStr}_${supplierStr}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
