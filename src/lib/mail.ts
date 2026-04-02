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

  if (receipt.files.length === 0) {
    errors.push({ field: "file", message: "Keine Belegdatei vorhanden." });
  }

  if (!receipt.purposeId) {
    errors.push({ field: "purposeId", message: "Zweck ist erforderlich." });
  }
  if (!receipt.categoryId) {
    errors.push({ field: "categoryId", message: "Kategorie ist erforderlich." });
  }

  if (receipt.purpose.isHospitality) {
    if (!receipt.hospitality) {
      errors.push({ field: "hospitality", message: "Bewirtungsangaben fehlen." });
    } else {
      if (!receipt.hospitality.occasion?.trim()) {
        errors.push({ field: "hospitality.occasion", message: "Anlass ist erforderlich." });
      }
      if (!receipt.hospitality.guests?.trim()) {
        errors.push({ field: "hospitality.guests", message: "Gaeste/Teilnehmer sind erforderlich." });
      }
      if (!receipt.hospitality.location?.trim()) {
        errors.push({ field: "hospitality.location", message: "Ort ist erforderlich." });
      }
    }
  }

  if (receipt.currency !== "EUR" && !receipt.exchangeRate) {
    errors.push({ field: "exchangeRate", message: "Wechselkurs fehlt bei Fremdwaehrung." });
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

  // Build email
  const subject = renderTemplate(
    datev.subjectTemplate ?? "Beleg {date} - {supplier} - {amount} {currency}",
    receipt,
  );
  const body = renderTemplate(
    datev.bodyTemplate ?? defaultBodyTemplate(),
    receipt,
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
      attachments: [
        {
          filename: originalFile.filename,
          content: fileBuffer,
          contentType: originalFile.mimeType,
        },
      ],
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

function renderTemplate(template: string, receipt: NonNullable<ReceiptForSend>): string {
  const dateStr = format(receipt.date, "dd.MM.yyyy", { locale: de });
  const amountStr = Number(receipt.amount).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const amountEurStr = Number(receipt.amountEur).toLocaleString("de-DE", {
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

function defaultBodyTemplate(): string {
  return [
    "Beleg vom {date}",
    "",
    "Lieferant: {supplier}",
    "Betrag: {amount} {currency}",
    "EUR-Betrag: {amountEur} EUR",
    "Zweck: {purpose}",
    "Kategorie: {category}",
    "Benutzer: {user}",
    "",
    "{remark}",
    "",
    "— Gesendet von BelegBox",
  ].join("\n");
}
