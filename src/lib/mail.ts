import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { readFile } from "@/lib/storage";
import { format } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================
// Types
// ============================================================

export type SendReceiptResult = {
  success: boolean;
  messageId: string | null;
  errorMessage: string | null;
};

type ReceiptForSend = Awaited<ReturnType<typeof loadReceiptForSend>>;

// ============================================================
// Pre-send validation
// ============================================================

export type SendValidationError = {
  field: string;
  message: string;
};

export async function validateForSend(receiptId: string): Promise<SendValidationError[]> {
  const errors: SendValidationError[] = [];

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      files: { where: { type: "ORIGINAL" }, take: 1 },
      purpose: { select: { isHospitality: true } },
      hospitality: true,
    },
  });

  if (!receipt) {
    errors.push({ field: "receipt", message: "Beleg nicht gefunden." });
    return errors;
  }

  // --- Technische Blocker: Ohne diese kann die E-Mail nicht rausgehen ---
  if (receipt.files.length === 0) {
    errors.push({ field: "file", message: "Keine Belegdatei vorhanden." });
  }

  const smtp = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
  if (!smtp) {
    errors.push({ field: "smtp", message: "SMTP-Einstellungen sind nicht konfiguriert." });
  }

  const datev = await prisma.datevProfile.findFirst({
    where: { active: true, isDefault: true },
  });
  if (!datev) {
    const anyProfile = await prisma.datevProfile.findFirst({ where: { active: true } });
    if (!anyProfile) {
      errors.push({ field: "datev", message: "Kein aktives DATEV-Profil vorhanden." });
    }
  }

  // Fremdwaehrung ohne gespeicherten Wechselkurs ist nur dann ein technischer
  // Blocker, wenn auch beim Versand kein aktueller Kurs geladen werden kann.
  if (receipt.currency !== "EUR" && !receipt.exchangeRate) {
    try {
      const { fetchLatestExchangeRate } = await import("@/lib/exchange-rates");
      await fetchLatestExchangeRate(receipt.currency);
    } catch {
      errors.push({
        field: "exchangeRate",
        message: "Wechselkurs fuer Fremdwaehrung konnte nicht ermittelt werden.",
      });
    }
  }

  // Felder wie Land, Lieferant, Rechnungsnummer, Netto, Steuer, Zweck, Kategorie
  // und Bewirtungsangaben sind KEINE technischen Versandblocker.
  // Diese werden ueber checkSendReadiness() als interne Warnungen behandelt.

  return errors;
}

// ============================================================
// Send receipt
// ============================================================

export async function sendReceipt(
  receiptId: string,
  datevProfileId?: string,
): Promise<SendReceiptResult> {
  // Load all required data
  const receipt = await loadReceiptForSend(receiptId);
  if (!receipt) {
    return { success: false, messageId: null, errorMessage: "Beleg nicht gefunden." };
  }

  // Resolve DATEV profile
  const datev = datevProfileId
    ? await prisma.datevProfile.findUnique({ where: { id: datevProfileId, active: true } })
    : await prisma.datevProfile.findFirst({
        where: { active: true, isDefault: true },
      }) ?? await prisma.datevProfile.findFirst({ where: { active: true } });

  if (!datev) {
    return { success: false, messageId: null, errorMessage: "Kein aktives DATEV-Profil gefunden." };
  }

  // Load SMTP config
  const smtp = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
  if (!smtp) {
    return { success: false, messageId: null, errorMessage: "SMTP ist nicht konfiguriert." };
  }

  let password: string;
  try {
    password = decrypt(smtp.passwordEncrypted);
  } catch {
    return { success: false, messageId: null, errorMessage: "SMTP-Passwort konnte nicht entschluesselt werden." };
  }

  // Load original file
  const originalFile = receipt.files[0];
  if (!originalFile) {
    return { success: false, messageId: null, errorMessage: "Keine Belegdatei vorhanden." };
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(originalFile.storagePath);
  } catch {
    return { success: false, messageId: null, errorMessage: "Belegdatei konnte nicht gelesen werden." };
  }

  // For foreign-currency image receipts, fetch a fresh exchange rate at send time
  // so the DATEV PDF shows the current EUR value, not a potentially stale one.
  let sendExchangeRate = receipt.exchangeRate ? Number(receipt.exchangeRate) : null;
  let sendExchangeRateDate = receipt.exchangeRateDate;
  let sendAmountEur = Number(receipt.amountEur);

  if (receipt.currency !== "EUR") {
    const { fetchLatestExchangeRate, calculateAmountEur } = await import("@/lib/exchange-rates");
    try {
      const fresh = await fetchLatestExchangeRate(receipt.currency);
      sendExchangeRate = fresh.rate;
      sendExchangeRateDate = new Date(fresh.rateDate);
      sendAmountEur = calculateAmountEur(Number(receipt.amount), receipt.currency, fresh.rate);
    } catch {
      // If no rate can be loaded and none is stored, block the send
      if (!sendExchangeRate) {
        return {
          success: false,
          messageId: null,
          errorMessage: "Wechselkurs fuer Fremdwaehrung konnte nicht ermittelt werden. Versand abgebrochen.",
        };
      }
      // Otherwise fall back to the stored rate and re-calculate the EUR amount
      // for the actual attachment payload.
      sendAmountEur = calculateAmountEur(Number(receipt.amount), receipt.currency, sendExchangeRate);
    }
  }

  // Determine DATEV attachment: PDF originals go as-is, images get wrapped in a DATEV PDF
  const attachment = await buildDatevAttachment(
    originalFile,
    fileBuffer,
    receipt,
    sendExchangeRate,
    sendExchangeRateDate,
    sendAmountEur,
  );

  // Build email
  const subject = renderTemplate(
    datev.subjectTemplate ?? "Beleg {date}",
    receipt,
    { amountEur: sendAmountEur },
  );
  const body = renderTemplate(
    datev.bodyTemplate ?? defaultBodyTemplate(),
    receipt,
    { amountEur: sendAmountEur },
  );

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.username, pass: password },
  });

  try {
    const info = await transporter.sendMail({
      from: datev.senderAddress,
      to: datev.datevAddress,
      replyTo: smtp.replyToAddress ?? undefined,
      subject,
      text: body,
      attachments: [attachment],
    });

    const messageId = info.messageId ?? null;

    // Log success
    await prisma.sendLog.create({
      data: {
        receiptId,
        toAddress: datev.datevAddress,
        success: true,
        messageId,
      },
    });

    // Update status
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        sendStatus: "SENT",
        sendStatusUpdatedAt: new Date(),
      },
    });

    return { success: true, messageId, errorMessage: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unbekannter SMTP-Fehler";

    // Log failure
    await prisma.sendLog.create({
      data: {
        receiptId,
        toAddress: datev.datevAddress,
        success: false,
        errorMessage,
      },
    });

    // Update status
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        sendStatus: "FAILED",
        sendStatusUpdatedAt: new Date(),
      },
    });

    return { success: false, messageId: null, errorMessage };
  }
}

// ============================================================
// Helpers
// ============================================================

async function loadReceiptForSend(receiptId: string) {
  return prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      user: { select: { name: true, email: true } },
      country: { select: { name: true, code: true } },
      vehicle: { select: { plate: true } },
      purpose: { select: { name: true } },
      category: { select: { name: true } },
      hospitality: true,
      files: { where: { type: "ORIGINAL" }, take: 1 },
    },
  });
}

function renderTemplate(
  template: string,
  receipt: NonNullable<ReceiptForSend>,
  overrides?: { amountEur?: number },
): string {
  const dateStr = format(receipt.date, "dd.MM.yyyy", { locale: de });
  const amountStr = Number(receipt.amount).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const amountEurStr = Number(overrides?.amountEur ?? receipt.amountEur).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return template
    .replace(/\{date\}/g, dateStr)
    .replace(/\{supplier\}/g, receipt.supplier ?? "Unbekannt")
    .replace(/\{amount\}/g, amountStr)
    .replace(/\{currency\}/g, receipt.currency)
    .replace(/\{amountEur\}/g, amountEurStr)
    .replace(/\{user\}/g, receipt.user.name)
    .replace(/\{purpose\}/g, receipt.purpose.name)
    .replace(/\{category\}/g, receipt.category.name)
    .replace(/\{country\}/g, receipt.country?.name ?? "—")
    .replace(/\{vehicle\}/g, receipt.vehicle?.plate ?? "—")
    .replace(/\{remark\}/g, receipt.remark ?? "");
}

/**
 * Build the DATEV email attachment.
 *
 * - PDF originals: attached as-is (all pages preserved)
 * - Image receipts (JPG/PNG): wrapped in a clean A4 PDF with the receipt image
 *   and business data on one page
 */
async function buildDatevAttachment(
  file: { filename: string; mimeType: string },
  fileBuffer: Buffer,
  receipt: NonNullable<ReceiptForSend>,
  sendExchangeRate: number | null,
  sendExchangeRateDate: Date | null,
  sendAmountEur: number,
): Promise<{ filename: string; content: Buffer; contentType: string }> {
  // PDF originals go directly — all pages preserved, no modification
  if (file.mimeType === "application/pdf") {
    return {
      filename: file.filename,
      content: fileBuffer,
      contentType: "application/pdf",
    };
  }

  // Image receipts → generate DATEV PDF with embedded image + business data
  // Uses the send-time exchange rate, not the stored one
  const { generateDatevPdf } = await import("@/lib/datev-pdf");
  const fmtDate = (d: Date) => format(d, "dd.MM.yyyy", { locale: de });
  const fmtAmount = (n: number) =>
    n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pdfBuffer = await generateDatevPdf({
    date: fmtDate(receipt.date),
    supplier: receipt.supplier,
    amount: fmtAmount(Number(receipt.amount)),
    currency: receipt.currency,
    amountEur: fmtAmount(sendAmountEur),
    exchangeRate: sendExchangeRate ? String(sendExchangeRate) : null,
    exchangeRateDate: sendExchangeRateDate ? fmtDate(sendExchangeRateDate) : null,
    purposeName: receipt.purpose.name,
    countryName: receipt.country
      ? `${receipt.country.name}${receipt.country.code ? ` (${receipt.country.code})` : ""}`
      : null,
    vehiclePlate: receipt.vehicle?.plate ?? null,
    remark: receipt.remark,
    hospitality: receipt.hospitality
      ? {
          occasion: receipt.hospitality.occasion,
          guests: receipt.hospitality.guests,
          location: receipt.hospitality.location,
        }
      : null,
    imageBase64: fileBuffer.toString("base64"),
    imageMimeType: file.mimeType,
  });

  // Filename: replace image extension with .pdf
  const pdfFilename = file.filename.replace(/\.(jpe?g|png)$/i, ".pdf") || "beleg.pdf";

  return {
    filename: pdfFilename,
    content: Buffer.from(pdfBuffer),
    contentType: "application/pdf",
  };
}

function defaultBodyTemplate(): string {
  return "Beleg vom {date} — siehe Anhang.";
}
