import { z } from "zod";
import { OCR_CONFIDENCE_LEVELS, OCR_DOCUMENT_TYPES, OCR_FIELD_REVIEW_STATUSES, OCR_PAYMENT_METHODS, RECEIPT_DOCUMENT_TYPE_VALUES } from "@/lib/ocr-suggestions";

export const loginSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z
    .string()
    .min(8, "Das Passwort muss mindestens 8 Zeichen haben."),
});

export const pinLoginSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4}$/, "Die PIN muss aus genau 4 Ziffern bestehen."),
});

// ============================================================
// User schemas
// ============================================================

export const createUserSchema = z.object({
  email: z.string().email("Bitte eine gueltige E-Mail-Adresse eingeben."),
  name: z.string().min(1, "Name ist erforderlich.").max(200),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben."),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export const updateUserSchema = z.object({
  email: z.string().email("Bitte eine gueltige E-Mail-Adresse eingeben.").optional(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich."),
  newPassword: z.string().min(8, "Das neue Passwort muss mindestens 8 Zeichen haben."),
});

export const setPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "Die PIN muss aus genau 4 Ziffern bestehen."),
});

export const changePinSchema = z.object({
  currentPassword: z.string().min(1, "Passwort ist zur PIN-Aenderung erforderlich."),
  pin: z.string().regex(/^\d{4}$/, "Die PIN muss aus genau 4 Ziffern bestehen."),
});

export const adminSetPasswordSchema = z.object({
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben."),
});

export const userReceiptDefaultsSchema = z.object({
  defaultCountryId: z.string().min(1).nullable().optional(),
  defaultVehicleId: z.string().min(1).nullable().optional(),
  defaultPurposeId: z.string().min(1).nullable().optional(),
  defaultCategoryId: z.string().min(1).nullable().optional(),
});

// ============================================================
// Master data schemas
// ============================================================

export const countrySchema = z.object({
  name: z.string().min(1, "Name ist erforderlich.").max(100),
  code: z.string().max(2).nullable().optional(),
  currencyCode: z.string().length(3).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const vehicleSchema = z.object({
  plate: z.string().min(1, "Kennzeichen ist erforderlich.").max(20),
  description: z.string().max(200).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const purposeSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich.").max(100),
  isHospitality: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Name ist erforderlich.").max(100),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

// ============================================================
// SMTP schema
// ============================================================

export const smtpConfigSchema = z.object({
  host: z.string().min(1, "Host ist erforderlich."),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(true),
  username: z.string().min(1, "Benutzername ist erforderlich."),
  password: z.string().min(1, "Passwort ist erforderlich.").optional(),
  fromAddress: z.string().email("Gueltige Absenderadresse erforderlich."),
  replyToAddress: z.string().email().nullable().optional(),
});

// ============================================================
// DATEV profile schema
// ============================================================

export const datevProfileSchema = z.object({
  name: z.string().min(1, "Profilname ist erforderlich.").max(100),
  datevAddress: z.string().email("Gueltige DATEV-Adresse erforderlich."),
  senderAddress: z.string().email("Gueltige Absenderadresse erforderlich."),
  subjectTemplate: z.string().max(500).nullable().optional(),
  bodyTemplate: z.string().max(5000).nullable().optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

// ============================================================
// Receipt schemas
// ============================================================

const hospitalitySchema = z.object({
  occasion: z.string().min(1, "Anlass ist fuer Bewirtung erforderlich."),
  guests: z
    .string()
    .min(1, "Gaeste/Teilnehmer sind fuer Bewirtung erforderlich."),
  location: z.string().min(1, "Ort ist fuer Bewirtung erforderlich."),
});

const aiConfidenceSchema = z.enum(OCR_CONFIDENCE_LEVELS);
const aiDocumentTypeSchema = z.enum(OCR_DOCUMENT_TYPES);
const receiptDocumentTypeSchema = z.enum(RECEIPT_DOCUMENT_TYPE_VALUES);
const paymentMethodSchema = z.enum(OCR_PAYMENT_METHODS);
const fieldReviewStatusSchema = z.enum(OCR_FIELD_REVIEW_STATUSES);

const aiLineItemSchema = z.object({
  label: z.string().min(1).max(120),
  amount: z.number().nullable(),
});

const aiLodgingSchema = z.object({
  location: z.string().max(255).nullable(),
  nights: z.number().int().min(0).nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  fees: z.number().nullable(),
  lineItems: z.array(aiLineItemSchema).max(10),
});

const aiParkingSchema = z.object({
  location: z.string().max(255).nullable(),
  durationText: z.string().max(80).nullable(),
  entryTime: z.string().nullable(),
  exitTime: z.string().nullable(),
});

const aiTollSchema = z.object({
  station: z.string().max(255).nullable(),
  routeHint: z.string().max(255).nullable(),
  vehicleClass: z.string().max(80).nullable(),
});

const aiInvoiceLineItemSchema = z.object({
  lineNumber: z.number().int().positive().nullable(),
  description: z.string().max(180),
  quantity: z.number().nullable(),
  unit: z.string().max(20).nullable(),
  unitPrice: z.number().nullable(),
  totalPrice: z.number().nullable(),
  taxHint: z.string().max(40).nullable(),
  confidence: aiConfidenceSchema,
  status: z.enum(["confident", "uncertain", "partial"]),
});

export const aiStructuredDataSchema = z.object({
  sourceType: z.enum(["image", "pdf"]).optional(),
  extracted: z.object({
    date: z.string().nullable(),
    invoiceDate: z.string().nullable(),
    dueDate: z.string().nullable(),
    serviceDate: z.string().nullable(),
    time: z.string().nullable(),
    amount: z.number().nullable(),
    grossAmount: z.number().nullable(),
    netAmount: z.number().nullable(),
    taxAmount: z.number().nullable(),
    currency: z.string().length(3).nullable(),
    supplier: z.string().max(255).nullable(),
    invoiceNumber: z.string().max(40).nullable(),
    location: z.string().max(255).nullable(),
    paymentMethod: paymentMethodSchema.nullable(),
    cardLastDigits: z.string().regex(/^\d{2,4}$/).nullable(),
    countryCode: z.string().max(3).nullable(),
    countryName: z.string().max(100).nullable(),
    documentType: aiDocumentTypeSchema.nullable(),
  }),
  fieldConfidence: z.object({
    date: aiConfidenceSchema,
    invoiceDate: aiConfidenceSchema,
    dueDate: aiConfidenceSchema,
    serviceDate: aiConfidenceSchema,
    time: aiConfidenceSchema,
    amount: aiConfidenceSchema,
    grossAmount: aiConfidenceSchema,
    netAmount: aiConfidenceSchema,
    taxAmount: aiConfidenceSchema,
    currency: aiConfidenceSchema,
    supplier: aiConfidenceSchema,
    invoiceNumber: aiConfidenceSchema,
    location: aiConfidenceSchema,
    paymentMethod: aiConfidenceSchema,
    cardLastDigits: aiConfidenceSchema,
    country: aiConfidenceSchema,
    documentType: aiConfidenceSchema,
  }),
  special: z.object({
    fuel: z.object({
      liters: z.number().nullable(),
      pricePerLiter: z.number().nullable(),
      fuelType: z.string().max(80).nullable(),
    }).nullable(),
    hospitality: z.object({
      location: z.string().max(255).nullable(),
      subtotal: z.number().nullable(),
      tip: z.number().nullable(),
      lineItems: z.array(aiLineItemSchema).max(10),
    }).nullable(),
    lodging: aiLodgingSchema.nullable(),
    parking: aiParkingSchema.nullable(),
    toll: aiTollSchema.nullable(),
    invoice: z.object({
      lineItems: z.array(aiInvoiceLineItemSchema).max(20),
    }).nullable(),
  }),
  fieldReviewStates: z.record(fieldReviewStatusSchema).optional(),
  specialConfidence: z.object({
    fuel: z.object({
      liters: aiConfidenceSchema,
      pricePerLiter: aiConfidenceSchema,
      fuelType: aiConfidenceSchema,
    }).nullable(),
    hospitality: z.object({
      location: aiConfidenceSchema,
      subtotal: aiConfidenceSchema,
      tip: aiConfidenceSchema,
      lineItems: aiConfidenceSchema,
    }).nullable(),
    lodging: z.object({
      location: aiConfidenceSchema,
      nights: aiConfidenceSchema,
      subtotal: aiConfidenceSchema,
      tax: aiConfidenceSchema,
      fees: aiConfidenceSchema,
      lineItems: aiConfidenceSchema,
    }).nullable(),
    parking: z.object({
      location: aiConfidenceSchema,
      durationText: aiConfidenceSchema,
      entryTime: aiConfidenceSchema,
      exitTime: aiConfidenceSchema,
    }).nullable(),
    toll: z.object({
      station: aiConfidenceSchema,
      routeHint: aiConfidenceSchema,
      vehicleClass: aiConfidenceSchema,
    }).nullable(),
    invoice: z.object({
      lineItems: aiConfidenceSchema,
    }).nullable(),
  }),
}).nullable();

const receiptSchemaBase = z.object({
  date: z.string().date(),
  supplier: z.string().max(255).nullable().optional(),
  invoiceNumber: z.string().max(80).nullable().optional(),
  serviceDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  amount: z.coerce.number().positive("Betrag muss groesser als 0 sein."),
  currency: z
    .string()
    .length(3, "ISO-4217-Waehrungscode mit 3 Zeichen.")
    .default("EUR"),
  netAmount: z.coerce.number().nonnegative().nullable().optional(),
  taxAmount: z.coerce.number().nonnegative().nullable().optional(),
  exchangeRate: z.coerce.number().positive().nullable().optional(),
  exchangeRateDate: z.string().date().nullable().optional(),
  amountEur: z.coerce.number().nonnegative().nullable().optional(),
  countryId: z.string().min(1).nullable().optional(),
  vehicleId: z.string().min(1).nullable().optional(),
  purposeId: z.string().min(1),
  categoryId: z.string().min(1),
  remark: z.string().max(2000).nullable().optional(),
  aiRawText: z.string().nullable().optional(),
  aiDocumentType: receiptDocumentTypeSchema.nullable().optional(),
  aiStructuredData: aiStructuredDataSchema.optional(),
  hospitality: hospitalitySchema.nullable().optional(),
});

const sendCurrencyRefinement = (
  value: { currency?: string; exchangeRate?: number | null; exchangeRateDate?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (!value.currency || value.currency === "EUR") {
    return;
  }

  if (!value.exchangeRate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Wechselkurs ist bei Fremdwaehrung erforderlich.",
      path: ["exchangeRate"],
    });
  }

  if (!value.exchangeRateDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Kursdatum ist bei Fremdwaehrung erforderlich.",
      path: ["exchangeRateDate"],
    });
  }
};

export const receiptSchema = receiptSchemaBase;

export const receiptUpdateSchema = receiptSchemaBase.partial();

export const sendReadySchema = z
  .object({
    date: z.string().date(),
    supplier: z.string().max(255).nullable().optional(),
    invoiceNumber: z.string().max(80).nullable().optional(),
    serviceDate: z.string().date().nullable().optional(),
    dueDate: z.string().date().nullable().optional(),
    amount: z.coerce.number().positive("Betrag muss groesser als 0 sein."),
    currency: z
      .string()
      .length(3, "ISO-4217-Waehrungscode mit 3 Zeichen.")
      .default("EUR"),
    netAmount: z.coerce.number().nonnegative().nullable().optional(),
    taxAmount: z.coerce.number().nonnegative().nullable().optional(),
    exchangeRate: z.coerce.number().positive().nullable().optional(),
    exchangeRateDate: z.string().date().nullable().optional(),
    amountEur: z.coerce.number().nonnegative().nullable().optional(),
    countryId: z.string().min(1, "Land ist fuer den Versand erforderlich."),
    vehicleId: z.string().min(1).nullable().optional(),
    purposeId: z.string().min(1),
    categoryId: z.string().min(1),
    remark: z.string().max(2000).nullable().optional(),
    hospitality: hospitalitySchema.nullable().optional(),
  })
  .superRefine(sendCurrencyRefinement);

/**
 * Readiness check for DATEV send.
 *
 * DATEV-Versand = E-Mail mit Belegdatei als Anhang.
 * Technische Blocker (nicht_sendbar): Kein Beleg-Attachment, kein DATEV-Profil/SMTP.
 * Interne Warnungen (pruefen): Fehlende Felder fuer Buchhaltung/Controlling.
 *
 * Felder wie Rechnungsnummer, Netto, Steuer, Land, Lieferant sind KEINE
 * technischen Versandblocker — sie sind interne Qualitaetshinweise.
 */
export type SendReadiness = {
  status: "sendbar" | "pruefen" | "nicht_sendbar";
  issues: Array<{ field: string; message: string; severity: "error" | "warning" }>;
};

export function checkSendReadiness(receipt: {
  date: string | Date | null;
  amount: number | null;
  currency: string | null;
  supplier: string | null;
  invoiceNumber: string | null;
  netAmount: number | null;
  taxAmount: number | null;
  countryId: string | null;
  purposeId: string | null;
  categoryId: string | null;
  exchangeRate: number | null;
  hasFile?: boolean;
  hasSmtp?: boolean;
  hasDatev?: boolean;
}): SendReadiness {
  const issues: SendReadiness["issues"] = [];

  // --- Technische DATEV-Blocker (nicht_sendbar) ---
  // Ohne diese kann die E-Mail an DATEV physisch nicht rausgehen.
  if (receipt.hasFile === false) {
    issues.push({ field: "file", message: "Keine Belegdatei vorhanden.", severity: "error" });
  }
  if (receipt.hasSmtp === false) {
    issues.push({ field: "smtp", message: "SMTP ist nicht konfiguriert.", severity: "error" });
  }
  if (receipt.hasDatev === false) {
    issues.push({ field: "datev", message: "Kein aktives DATEV-Profil vorhanden.", severity: "error" });
  }

  // --- Hinweis: Fremdwaehrung ohne gespeicherten Kurs ---
  // Der aktuelle Kurs wird beim Versand geladen. Solange das noch nicht passiert ist,
  // ist das in der UI nur ein Warnhinweis und kein harter Blocker.
  if (receipt.currency && receipt.currency !== "EUR" && !receipt.exchangeRate) {
    issues.push({
      field: "exchangeRate",
      message: "Kein gespeicherter Wechselkurs vorhanden. Der aktuelle Kurs wird beim Versand geladen.",
      severity: "warning",
    });
  }

  // --- Interne Warnungen (pruefen) ---
  // Diese verhindern den Versand nicht, sind aber fuer Buchhaltung/Controlling wichtig.
  if (!receipt.date) issues.push({ field: "date", message: "Belegdatum fehlt.", severity: "warning" });
  if (!receipt.amount || receipt.amount <= 0) issues.push({ field: "amount", message: "Betrag fehlt oder ist ungueltig.", severity: "warning" });
  if (!receipt.purposeId) issues.push({ field: "purposeId", message: "Zweck fehlt.", severity: "warning" });
  if (!receipt.categoryId) issues.push({ field: "categoryId", message: "Kategorie fehlt.", severity: "warning" });
  if (!receipt.countryId) issues.push({ field: "countryId", message: "Land fehlt.", severity: "warning" });
  if (!receipt.supplier) issues.push({ field: "supplier", message: "Lieferant fehlt.", severity: "warning" });
  if (!receipt.invoiceNumber) issues.push({ field: "invoiceNumber", message: "Rechnungsnummer fehlt.", severity: "warning" });
  if (receipt.netAmount == null) issues.push({ field: "netAmount", message: "Nettobetrag fehlt.", severity: "warning" });
  if (receipt.taxAmount == null) issues.push({ field: "taxAmount", message: "Steuerbetrag fehlt.", severity: "warning" });

  const hasErrors = issues.some((i) => i.severity === "error");
  const hasWarnings = issues.some((i) => i.severity === "warning");

  return {
    status: hasErrors ? "nicht_sendbar" : hasWarnings ? "pruefen" : "sendbar",
    issues,
  };
}
