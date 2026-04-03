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

const ocrConfidenceSchema = z.enum(OCR_CONFIDENCE_LEVELS);
const ocrDocumentTypeSchema = z.enum(OCR_DOCUMENT_TYPES);
const receiptDocumentTypeSchema = z.enum(RECEIPT_DOCUMENT_TYPE_VALUES);
const paymentMethodSchema = z.enum(OCR_PAYMENT_METHODS);
const fieldReviewStatusSchema = z.enum(OCR_FIELD_REVIEW_STATUSES);

const ocrLineItemSchema = z.object({
  label: z.string().min(1).max(120),
  amount: z.number().nullable(),
});

const ocrLodgingSchema = z.object({
  location: z.string().max(255).nullable(),
  nights: z.number().int().min(0).nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  fees: z.number().nullable(),
  lineItems: z.array(ocrLineItemSchema).max(10),
});

const ocrParkingSchema = z.object({
  location: z.string().max(255).nullable(),
  durationText: z.string().max(80).nullable(),
  entryTime: z.string().nullable(),
  exitTime: z.string().nullable(),
});

const ocrTollSchema = z.object({
  station: z.string().max(255).nullable(),
  routeHint: z.string().max(255).nullable(),
  vehicleClass: z.string().max(80).nullable(),
});

const ocrInvoiceLineItemSchema = z.object({
  lineNumber: z.number().int().positive().nullable(),
  description: z.string().max(180),
  quantity: z.number().nullable(),
  unit: z.string().max(20).nullable(),
  unitPrice: z.number().nullable(),
  totalPrice: z.number().nullable(),
  taxHint: z.string().max(10).nullable(),
  confidence: ocrConfidenceSchema,
  status: z.enum(["confident", "uncertain", "partial"]),
});

export const ocrStructuredDataSchema = z.object({
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
    documentType: ocrDocumentTypeSchema.nullable(),
  }),
  fieldConfidence: z.object({
    date: ocrConfidenceSchema,
    invoiceDate: ocrConfidenceSchema,
    dueDate: ocrConfidenceSchema,
    serviceDate: ocrConfidenceSchema,
    time: ocrConfidenceSchema,
    amount: ocrConfidenceSchema,
    grossAmount: ocrConfidenceSchema,
    netAmount: ocrConfidenceSchema,
    taxAmount: ocrConfidenceSchema,
    currency: ocrConfidenceSchema,
    supplier: ocrConfidenceSchema,
    invoiceNumber: ocrConfidenceSchema,
    location: ocrConfidenceSchema,
    paymentMethod: ocrConfidenceSchema,
    cardLastDigits: ocrConfidenceSchema,
    country: ocrConfidenceSchema,
    documentType: ocrConfidenceSchema,
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
      lineItems: z.array(ocrLineItemSchema).max(10),
    }).nullable(),
    lodging: ocrLodgingSchema.nullable(),
    parking: ocrParkingSchema.nullable(),
    toll: ocrTollSchema.nullable(),
    invoice: z.object({
      lineItems: z.array(ocrInvoiceLineItemSchema).max(20),
    }).nullable(),
  }),
  fieldReviewStates: z.record(fieldReviewStatusSchema).optional(),
  specialConfidence: z.object({
    fuel: z.object({
      liters: ocrConfidenceSchema,
      pricePerLiter: ocrConfidenceSchema,
      fuelType: ocrConfidenceSchema,
    }).nullable(),
    hospitality: z.object({
      location: ocrConfidenceSchema,
      subtotal: ocrConfidenceSchema,
      tip: ocrConfidenceSchema,
      lineItems: ocrConfidenceSchema,
    }).nullable(),
    lodging: z.object({
      location: ocrConfidenceSchema,
      nights: ocrConfidenceSchema,
      subtotal: ocrConfidenceSchema,
      tax: ocrConfidenceSchema,
      fees: ocrConfidenceSchema,
      lineItems: ocrConfidenceSchema,
    }).nullable(),
    parking: z.object({
      location: ocrConfidenceSchema,
      durationText: ocrConfidenceSchema,
      entryTime: ocrConfidenceSchema,
      exitTime: ocrConfidenceSchema,
    }).nullable(),
    toll: z.object({
      station: ocrConfidenceSchema,
      routeHint: ocrConfidenceSchema,
      vehicleClass: ocrConfidenceSchema,
    }).nullable(),
    invoice: z.object({
      lineItems: ocrConfidenceSchema,
    }).nullable(),
  }),
}).nullable();

const receiptSchemaBase = z.object({
  date: z.string().date(),
  supplier: z.string().max(255).nullable().optional(),
  amount: z.coerce.number().positive("Betrag muss groesser als 0 sein."),
  currency: z
    .string()
    .length(3, "ISO-4217-Waehrungscode mit 3 Zeichen.")
    .default("EUR"),
  exchangeRate: z.coerce.number().positive().nullable().optional(),
  exchangeRateDate: z.string().date().nullable().optional(),
  amountEur: z.coerce.number().nonnegative().nullable().optional(),
  countryId: z.string().min(1).nullable().optional(),
  vehicleId: z.string().min(1).nullable().optional(),
  purposeId: z.string().min(1),
  categoryId: z.string().min(1),
  remark: z.string().max(2000).nullable().optional(),
  ocrRawText: z.string().nullable().optional(),
  detectedDocumentType: receiptDocumentTypeSchema.nullable().optional(),
  ocrStructuredData: ocrStructuredDataSchema.optional(),
  hospitality: hospitalitySchema.nullable().optional(),
});

const currencyRefinement = (
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

export const receiptSchema = receiptSchemaBase.superRefine(currencyRefinement);

export const receiptUpdateSchema = receiptSchemaBase.partial().superRefine(currencyRefinement);

export const sendReadySchema = z
  .object({
    date: z.string().date(),
    supplier: z.string().max(255).nullable().optional(),
    amount: z.coerce.number().positive("Betrag muss größer als 0 sein."),
    currency: z
      .string()
      .length(3, "ISO-4217-Währungscode mit 3 Zeichen.")
      .default("EUR"),
    exchangeRate: z.coerce.number().positive().nullable().optional(),
    exchangeRateDate: z.string().date().nullable().optional(),
    amountEur: z.coerce.number().nonnegative().nullable().optional(),
    countryId: z.string().min(1, "Land ist für den Versand erforderlich."),
    vehicleId: z.string().min(1).nullable().optional(),
    purposeId: z.string().min(1),
    categoryId: z.string().min(1),
    remark: z.string().max(2000).nullable().optional(),
    hospitality: hospitalitySchema.nullable().optional(),
  })
  .superRefine(currencyRefinement);
