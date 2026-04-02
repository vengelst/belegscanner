/**
 * OCR service for receipt documents.
 *
 * Images are analyzed directly with Tesseract.js.
 * PDFs first try native text extraction; if the PDF does not contain usable text,
 * the first pages are rendered to images and passed through the same OCR flow.
 */

import {
  type OcrConfidenceLevel,
  type OcrDocumentType,
  type OcrPaymentMethod,
} from "@/lib/ocr-suggestions";

export type OcrSourceType = "image" | "pdf-text" | "pdf-scan" | "pdf-empty";

export type OcrLineItem = {
  label: string;
  amount: number | null;
};

export type OcrInvoiceLineItemStatus = "confident" | "uncertain" | "partial";

export type OcrInvoiceLineItem = {
  lineNumber: number | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  taxHint: string | null;
  confidence: OcrConfidenceLevel;
  status: OcrInvoiceLineItemStatus;
};

export type OcrResult = {
  sourceType: OcrSourceType;
  rawText: string;
  extracted: {
    date: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    serviceDate: string | null;
    time: string | null;
    amount: number | null;
    grossAmount: number | null;
    netAmount: number | null;
    taxAmount: number | null;
    currency: string | null;
    supplier: string | null;
    invoiceNumber: string | null;
    location: string | null;
    paymentMethod: OcrPaymentMethod | null;
    cardLastDigits: string | null;
    countryCode: string | null;
    countryName: string | null;
    documentType: OcrDocumentType | null;
  };
  special: {
    fuel: {
      liters: number | null;
      pricePerLiter: number | null;
      fuelType: string | null;
    } | null;
    hospitality: {
      location: string | null;
      subtotal: number | null;
      tip: number | null;
      lineItems: OcrLineItem[];
    } | null;
    lodging: {
      location: string | null;
      nights: number | null;
      subtotal: number | null;
      tax: number | null;
      fees: number | null;
      lineItems: OcrLineItem[];
    } | null;
    parking: {
      location: string | null;
      durationText: string | null;
      entryTime: string | null;
      exitTime: string | null;
    } | null;
    toll: {
      station: string | null;
      routeHint: string | null;
      vehicleClass: string | null;
    } | null;
    invoice: {
      lineItems: OcrInvoiceLineItem[];
    } | null;
  };
  confidence: number;
  fieldConfidence: {
    date: OcrConfidenceLevel;
    invoiceDate: OcrConfidenceLevel;
    dueDate: OcrConfidenceLevel;
    serviceDate: OcrConfidenceLevel;
    time: OcrConfidenceLevel;
    amount: OcrConfidenceLevel;
    grossAmount: OcrConfidenceLevel;
    netAmount: OcrConfidenceLevel;
    taxAmount: OcrConfidenceLevel;
    currency: OcrConfidenceLevel;
    supplier: OcrConfidenceLevel;
    invoiceNumber: OcrConfidenceLevel;
    location: OcrConfidenceLevel;
    paymentMethod: OcrConfidenceLevel;
    cardLastDigits: OcrConfidenceLevel;
    country: OcrConfidenceLevel;
    documentType: OcrConfidenceLevel;
  };
  specialConfidence: {
    fuel: {
      liters: OcrConfidenceLevel;
      pricePerLiter: OcrConfidenceLevel;
      fuelType: OcrConfidenceLevel;
    } | null;
    hospitality: {
      location: OcrConfidenceLevel;
      subtotal: OcrConfidenceLevel;
      tip: OcrConfidenceLevel;
      lineItems: OcrConfidenceLevel;
    } | null;
    lodging: {
      location: OcrConfidenceLevel;
      nights: OcrConfidenceLevel;
      subtotal: OcrConfidenceLevel;
      tax: OcrConfidenceLevel;
      fees: OcrConfidenceLevel;
      lineItems: OcrConfidenceLevel;
    } | null;
    parking: {
      location: OcrConfidenceLevel;
      durationText: OcrConfidenceLevel;
      entryTime: OcrConfidenceLevel;
      exitTime: OcrConfidenceLevel;
    } | null;
    toll: {
      station: OcrConfidenceLevel;
      routeHint: OcrConfidenceLevel;
      vehicleClass: OcrConfidenceLevel;
    } | null;
    invoice: {
      lineItems: OcrConfidenceLevel;
    } | null;
  };
  message: string | null;
};

type FieldResult<T> = { value: T | null; confidence: OcrConfidenceLevel };
type CountryResult = { code: string | null; name: string | null; confidence: OcrConfidenceLevel };
type TesseractAdapter = {
  recognize: (image: Buffer, languages?: string) => Promise<{
    data?: {
      text?: string;
      confidence?: number;
    };
  }>;
};

type FuelDetails = {
  liters: FieldResult<number>;
  pricePerLiter: FieldResult<number>;
  fuelType: FieldResult<string>;
  totalAmount: FieldResult<number>;
};

type HospitalityDetails = {
  location: FieldResult<string>;
  subtotal: FieldResult<number>;
  tip: FieldResult<number>;
  lineItems: OcrLineItem[];
};

type LodgingDetails = {
  location: FieldResult<string>;
  nights: FieldResult<number>;
  subtotal: FieldResult<number>;
  tax: FieldResult<number>;
  fees: FieldResult<number>;
  lineItems: OcrLineItem[];
};

type ParkingDetails = {
  location: FieldResult<string>;
  durationText: FieldResult<string>;
  entryTime: FieldResult<string>;
  exitTime: FieldResult<string>;
};

type TollDetails = {
  station: FieldResult<string>;
  routeHint: FieldResult<string>;
  vehicleClass: FieldResult<string>;
};

type InvoiceDetails = {
  lineItems: OcrInvoiceLineItem[];
};

type ParsedReceiptText = {
  date: FieldResult<string>;
  invoiceDate: FieldResult<string>;
  dueDate: FieldResult<string>;
  serviceDate: FieldResult<string>;
  time: FieldResult<string>;
  amount: FieldResult<number>;
  grossAmount: FieldResult<number>;
  netAmount: FieldResult<number>;
  taxAmount: FieldResult<number>;
  currency: FieldResult<string>;
  supplier: FieldResult<string>;
  invoiceNumber: FieldResult<string>;
  location: FieldResult<string>;
  paymentMethod: FieldResult<OcrPaymentMethod>;
  cardLastDigits: FieldResult<string>;
  country: CountryResult;
  documentType: FieldResult<OcrDocumentType>;
  special: {
    fuel: FuelDetails | null;
    hospitality: HospitalityDetails | null;
    lodging: LodgingDetails | null;
    parking: ParkingDetails | null;
    toll: TollDetails | null;
    invoice: InvoiceDetails | null;
  };
};

const EMPTY_RESULT: OcrResult = {
  sourceType: "pdf-empty",
  rawText: "",
  extracted: {
    date: null,
    invoiceDate: null,
    dueDate: null,
    serviceDate: null,
    time: null,
    amount: null,
    grossAmount: null,
    netAmount: null,
    taxAmount: null,
    currency: null,
    supplier: null,
    invoiceNumber: null,
    location: null,
    paymentMethod: null,
    cardLastDigits: null,
    countryCode: null,
    countryName: null,
    documentType: null,
  },
  special: { fuel: null, hospitality: null, lodging: null, parking: null, toll: null, invoice: null },
  confidence: 0,
  fieldConfidence: {
    date: "none",
    invoiceDate: "none",
    dueDate: "none",
    serviceDate: "none",
    time: "none",
    amount: "none",
    grossAmount: "none",
    netAmount: "none",
    taxAmount: "none",
    currency: "none",
    supplier: "none",
    invoiceNumber: "none",
    location: "none",
    paymentMethod: "none",
    cardLastDigits: "none",
    country: "none",
    documentType: "none",
  },
  specialConfidence: {
    fuel: { liters: "none", pricePerLiter: "none", fuelType: "none" },
    hospitality: { location: "none", subtotal: "none", tip: "none", lineItems: "none" },
    lodging: { location: "none", nights: "none", subtotal: "none", tax: "none", fees: "none", lineItems: "none" },
    parking: { location: "none", durationText: "none", entryTime: "none", exitTime: "none" },
    toll: { station: "none", routeHint: "none", vehicleClass: "none" },
    invoice: { lineItems: "none" },
  },
  message: null,
};

const MAX_PDF_SCAN_PAGES = 3;
const SUPPORTED_CURRENCIES = ["EUR", "CHF", "RSD", "MKD", "USD", "GBP", "CZK", "HRK", "PLN", "HUF", "RON", "BGN", "SEK", "NOK", "DKK"] as const;
const FUEL_KEYWORDS = [/tankstelle/i, /kraftstoff/i, /diesel/i, /super\s*e?1?0?/i, /benzin/i, /fuel/i, /lit(?:er|ers|re|res)?\b/i, /\be10\b/i, /\be5\b/i, /autogas/i, /lpg/i];
const HOSPITALITY_KEYWORDS = [/restaurant/i, /cafe/i, /bistro/i, /gaststaette/i, /pizzeria/i, /bar\b/i, /speise/i, /getraenk/i, /trinkgeld/i, /table\s*\d+/i, /tisch\s*\d+/i];
const LODGING_KEYWORDS = [/hotel/i, /unterkunft/i, /uebernacht/i, /overnight/i, /zimmer/i, /room\b/i, /check-?in/i, /check-?out/i, /reservation/i, /booking/i, /nacht\b/i];
const PARKING_KEYWORDS = [/parken/i, /parkhaus/i, /parkticket/i, /parking/i, /garage/i, /ticket\s*nr/i, /einfahrt/i, /ausfahrt/i];
const TOLL_KEYWORDS = [/maut/i, /toll/i, /peage/i, /putarina/i, /enc\b/i, /naplatna/i, /autocesta/i, /autobahn/i, /station\b/i];
const INVOICE_HEADER_KEYWORDS = /(beschreibung|artikel|leistung|leistungsbeschreibung|description|item|produkt|qty|menge|anzahl|einzelpreis|preis|gesamt|total)/i;
const INVOICE_SECTION_END = /(summe|gesamtbetrag|brutto|netto|mwst|mehrwertsteuer|umsatzsteuer|steuerbetrag|subtotal|total due|amount due|zu\s*zahlen|zahlbar|iban|bic)/i;
const INVOICE_LINE_SKIP = /(rechnungsdatum|leistungsdatum|lieferdatum|kunde|kundennummer|customer|client|empfaenger|bill to|ship to|ust-?id|vat|iban|bic|zahlung|payment|seite\b|page\b|rechnungsnummer|invoice\s*(nr|no|number))/i;
const COUNTRY_RULES = [
  { code: "DE", name: "Deutschland", keywords: [/deutschland/i, /germany/i, /berlin/i, /muenchen/i, /hamburg/i, /koeln/i], vat: /\bDE\d{9}\b/, phone: /\+49|0049/, postal: /\b\d{5}\s+[A-Za-z]/ },
  { code: "AT", name: "Oesterreich", keywords: [/oesterreich/i, /austria/i, /wien/i, /salzburg/i, /graz/i], vat: /\bATU\d{8}\b/, phone: /\+43|0043/, postal: /\bA-?\d{4}\b/ },
  { code: "HR", name: "Kroatien", keywords: [/kroatien/i, /croatia/i, /zagreb/i, /split/i, /rijeka/i], vat: /\bHR\d{11}\b/, phone: /\+385|00385/, postal: /\bHR-?\d{5}\b/ },
  { code: "RS", name: "Serbien", keywords: [/serbien/i, /srbija/i, /serbia/i, /beograd/i, /novi\s*sad/i], vat: /\bRS\d{9}\b/, phone: /\+381|00381/, postal: /\b11\d{3}\b/ },
  { code: "MK", name: "Nordmazedonien", keywords: [/nordmazedonien/i, /north\s*macedonia/i, /macedonia/i, /skopje/i], vat: /\bMK\d{13}\b/, phone: /\+389|00389/, postal: /\b1\d{3}\b/ },
] as const;
const LOCATION_NOISE = /^(tel|fax|mail|e-mail|www|http|ust|steuer|mwst|iban|bic|kasse|bon|beleg|datum|table|tisch|rechnung|summe|gesamt|brutto|netto|zahlungsart|entry|exit|einfahrt|ausfahrt)\b/i;
const LINE_ITEM_SKIP = /(?:summe|gesamt|subtotal|zwischensumme|trinkgeld|tip|karte|zahlung|zahlungsart|mwst|steuer|netto|brutto|beleg|rechnung|amount due|zu zahlen)/i;

export async function analyzeDocument(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  if (mimeType === "application/pdf") {
    return analyzePdf(buffer);
  }

  try {
    const imageResult = await recognizeImageText(buffer);
    return buildResult(imageResult.rawText, imageResult.confidence, "image");
  } catch (err) {
    console.error("OCR image analysis failed:", {
      mimeType,
      error: toLoggableError(err),
    });
    return {
      ...EMPTY_RESULT,
      sourceType: "image",
      message: "OCR konnte fuer diese Datei nicht ausgefuehrt werden. Bitte Felder manuell pruefen oder ergaenzen.",
    };
  }
}

async function analyzePdf(buffer: Buffer): Promise<OcrResult> {
  let parser: {
    destroy(): Promise<void>;
    getText(options: { pageJoiner: string; lineEnforce: boolean }): Promise<{ text: string; total: number }>;
    getScreenshot(options: {
      first: number;
      desiredWidth: number;
      imageDataUrl: boolean;
      imageBuffer: boolean;
    }): Promise<{ pages: Array<{ data: Uint8Array | Buffer }>; total: number }>;
  } | null = null;

  try {
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: new Uint8Array(buffer) });

    const textResult = await parser.getText({
      pageJoiner: "\n\n",
      lineEnforce: true,
    });
    const extractedText = normalizeText(textResult.text);

    if (hasMeaningfulText(extractedText)) {
      return buildResult(extractedText, 0.92, "pdf-text");
    }

    const screenshotResult = await parser.getScreenshot({
      first: MAX_PDF_SCAN_PAGES,
      desiredWidth: 1800,
      imageDataUrl: false,
      imageBuffer: true,
    });

    const pageTexts: string[] = [];
    const confidences: number[] = [];

    for (const page of screenshotResult.pages) {
      const pageResult = await recognizeImageText(Buffer.from(page.data));
      const pageText = normalizeText(pageResult.rawText);
      if (pageText) pageTexts.push(pageText);
      confidences.push(pageResult.confidence);
    }

    const scanText = normalizeText(pageTexts.join("\n\n"));
    const scannedPageCount = screenshotResult.pages.length;
    const hasMorePages = textResult.total > scannedPageCount;

    if (hasMeaningfulText(scanText)) {
      const averageConfidence = confidences.length
        ? confidences.reduce((sum, current) => sum + current, 0) / confidences.length
        : 0;

      return {
        ...buildResult(scanText, averageConfidence, "pdf-scan"),
        message: hasMorePages
          ? `Scan-PDF ueber die ersten ${scannedPageCount} Seiten analysiert. Bitte Werte bei mehrseitigen Belegen pruefen.`
          : "Scan-PDF ueber Seitenbilder analysiert. Bitte Werte vor dem Speichern kurz pruefen.",
      };
    }

    return {
      ...EMPTY_RESULT,
      sourceType: "pdf-empty",
      message: hasMorePages
        ? `Im PDF wurde kein verwertbarer Text gefunden. Es wurden die ersten ${scannedPageCount} Seiten ohne brauchbares OCR-Ergebnis geprueft. Bitte Felder manuell ausfuellen.`
        : "Im PDF wurde kein verwertbarer Text gefunden. Bitte Felder manuell ausfuellen.",
    };
  } catch (err) {
    console.error("PDF OCR failed:", {
      error: toLoggableError(err),
    });
    return {
      ...EMPTY_RESULT,
      sourceType: "pdf-empty",
      message: "PDF konnte nicht gelesen oder analysiert werden. Datei bleibt gespeichert; bitte Felder manuell erfassen.",
    };
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

async function recognizeImageText(buffer: Buffer): Promise<{ rawText: string; confidence: number }> {
  const Tesseract = await resolveTesseractAdapter();
  const lang = process.env.OCR_LANGUAGE ?? "deu+eng";
  const response = await Tesseract.recognize(buffer, lang);
  const data = response.data ?? {};

  return {
    rawText: normalizeText(data.text ?? ""),
    confidence: (data.confidence ?? 0) / 100,
  };
}

async function resolveTesseractAdapter(): Promise<TesseractAdapter> {
  const imported = await import("tesseract.js");
  const adapter = ("default" in imported ? imported.default : imported) as Partial<TesseractAdapter>;

  if (typeof adapter.recognize !== "function") {
    throw new Error("Tesseract-Adapter ist nicht verfuegbar.");
  }

  return adapter as TesseractAdapter;
}

function toLoggableError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

function buildResult(rawText: string, confidence: number, sourceType: OcrSourceType): OcrResult {
  const parsed = parseReceiptText(rawText, sourceType);

  return {
    sourceType,
    rawText,
    extracted: {
      date: parsed.date.value,
      invoiceDate: parsed.invoiceDate.value,
      dueDate: parsed.dueDate.value,
      serviceDate: parsed.serviceDate.value,
      time: parsed.time.value,
      amount: parsed.amount.value,
      grossAmount: parsed.grossAmount.value,
      netAmount: parsed.netAmount.value,
      taxAmount: parsed.taxAmount.value,
      currency: parsed.currency.value,
      supplier: parsed.supplier.value,
      invoiceNumber: parsed.invoiceNumber.value,
      location: parsed.location.value,
      paymentMethod: parsed.paymentMethod.value,
      cardLastDigits: parsed.cardLastDigits.value,
      countryCode: parsed.country.code,
      countryName: parsed.country.name,
      documentType: parsed.documentType.value,
    },
    special: {
      fuel: parsed.special.fuel ? {
        liters: parsed.special.fuel.liters.value,
        pricePerLiter: parsed.special.fuel.pricePerLiter.value,
        fuelType: parsed.special.fuel.fuelType.value,
      } : null,
      hospitality: parsed.special.hospitality ? {
        location: parsed.special.hospitality.location.value,
        subtotal: parsed.special.hospitality.subtotal.value,
        tip: parsed.special.hospitality.tip.value,
        lineItems: parsed.special.hospitality.lineItems,
      } : null,
      lodging: parsed.special.lodging ? {
        location: parsed.special.lodging.location.value,
        nights: parsed.special.lodging.nights.value,
        subtotal: parsed.special.lodging.subtotal.value,
        tax: parsed.special.lodging.tax.value,
        fees: parsed.special.lodging.fees.value,
        lineItems: parsed.special.lodging.lineItems,
      } : null,
      parking: parsed.special.parking ? {
        location: parsed.special.parking.location.value,
        durationText: parsed.special.parking.durationText.value,
        entryTime: parsed.special.parking.entryTime.value,
        exitTime: parsed.special.parking.exitTime.value,
      } : null,
      toll: parsed.special.toll ? {
        station: parsed.special.toll.station.value,
        routeHint: parsed.special.toll.routeHint.value,
        vehicleClass: parsed.special.toll.vehicleClass.value,
      } : null,
      invoice: parsed.special.invoice ? {
        lineItems: parsed.special.invoice.lineItems,
      } : null,
    },
    confidence,
    fieldConfidence: {
      date: parsed.date.confidence,
      invoiceDate: parsed.invoiceDate.confidence,
      dueDate: parsed.dueDate.confidence,
      serviceDate: parsed.serviceDate.confidence,
      time: parsed.time.confidence,
      amount: parsed.amount.confidence,
      grossAmount: parsed.grossAmount.confidence,
      netAmount: parsed.netAmount.confidence,
      taxAmount: parsed.taxAmount.confidence,
      currency: parsed.currency.confidence,
      supplier: parsed.supplier.confidence,
      invoiceNumber: parsed.invoiceNumber.confidence,
      location: parsed.location.confidence,
      paymentMethod: parsed.paymentMethod.confidence,
      cardLastDigits: parsed.cardLastDigits.confidence,
      country: parsed.country.confidence,
      documentType: parsed.documentType.confidence,
    },
    specialConfidence: {
      fuel: parsed.special.fuel ? {
        liters: parsed.special.fuel.liters.confidence,
        pricePerLiter: parsed.special.fuel.pricePerLiter.confidence,
        fuelType: parsed.special.fuel.fuelType.confidence,
      } : null,
      hospitality: parsed.special.hospitality ? {
        location: parsed.special.hospitality.location.confidence,
        subtotal: parsed.special.hospitality.subtotal.confidence,
        tip: parsed.special.hospitality.tip.confidence,
        lineItems: parsed.special.hospitality.lineItems.length > 0 ? "medium" : "none",
      } : null,
      lodging: parsed.special.lodging ? {
        location: parsed.special.lodging.location.confidence,
        nights: parsed.special.lodging.nights.confidence,
        subtotal: parsed.special.lodging.subtotal.confidence,
        tax: parsed.special.lodging.tax.confidence,
        fees: parsed.special.lodging.fees.confidence,
        lineItems: parsed.special.lodging.lineItems.length > 0 ? "medium" : "none",
      } : null,
      parking: parsed.special.parking ? {
        location: parsed.special.parking.location.confidence,
        durationText: parsed.special.parking.durationText.confidence,
        entryTime: parsed.special.parking.entryTime.confidence,
        exitTime: parsed.special.parking.exitTime.confidence,
      } : null,
      toll: parsed.special.toll ? {
        station: parsed.special.toll.station.confidence,
        routeHint: parsed.special.toll.routeHint.confidence,
        vehicleClass: parsed.special.toll.vehicleClass.confidence,
      } : null,
      invoice: parsed.special.invoice ? {
        lineItems: parsed.special.invoice.lineItems.length >= 3
          ? "high"
          : parsed.special.invoice.lineItems.length > 0
            ? "medium"
            : "none",
      } : null,
    },
    message: null,
  };
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasMeaningfulText(text: string): boolean {
  if (!text) return false;
  const compact = text.replace(/\s/g, "");
  if (compact.length < 12) return false;
  return /[A-Za-z0-9]/.test(compact);
}

function parseReceiptText(text: string, sourceType: OcrSourceType): ParsedReceiptText {
  const lines = toLines(text);
  const dateFields = extractDateFields(lines, text);
  const time = extractTime(text);
  const currency = extractCurrency(text);
  const amountFields = extractAmountFields(lines, text);
  const supplier = extractSupplier(lines);
  const invoiceNumber = extractInvoiceNumber(lines);
  const location = extractLocation(lines);
  const paymentMethod = extractPaymentMethod(text);
  const cardLastDigits = extractCardLastDigits(text, paymentMethod);
  const fuel = extractFuelDetails(text, amountFields.amount);
  const hospitality = extractHospitalityDetails(lines, location);
  const lodging = extractLodgingDetails(lines, location);
  const parking = extractParkingDetails(lines, location, time);
  const toll = extractTollDetails(lines, location);
  const invoice = extractInvoiceDetails(lines, sourceType);
  const country = extractCountry(text, currency, location, supplier);
  const documentType = detectDocumentType(text, fuel, hospitality, lodging, parking, toll);

  return {
    date: dateFields.date,
    invoiceDate: dateFields.invoiceDate,
    dueDate: dateFields.dueDate,
    serviceDate: dateFields.serviceDate,
    time,
    amount: amountFields.amount,
    grossAmount: amountFields.grossAmount,
    netAmount: amountFields.netAmount,
    taxAmount: amountFields.taxAmount,
    currency,
    supplier,
    invoiceNumber,
    location,
    paymentMethod,
    cardLastDigits,
    country,
    documentType,
    special: {
      fuel: documentType.value === "fuel" || hasFuelSignals(fuel) ? fuel : null,
      hospitality: documentType.value === "hospitality" || hasHospitalitySignals(hospitality) ? hospitality : null,
      lodging: documentType.value === "lodging" || hasLodgingSignals(lodging) ? lodging : null,
      parking: documentType.value === "parking" || hasParkingSignals(parking) ? parking : null,
      toll: documentType.value === "toll" || hasTollSignals(toll) ? toll : null,
      invoice: invoice.lineItems.length > 0 ? invoice : null,
    },
  };
}

function toLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type DateFieldsResult = {
  date: FieldResult<string>;
  invoiceDate: FieldResult<string>;
  dueDate: FieldResult<string>;
  serviceDate: FieldResult<string>;
};

type AmountFieldsResult = {
  amount: FieldResult<number>;
  grossAmount: FieldResult<number>;
  netAmount: FieldResult<number>;
  taxAmount: FieldResult<number>;
};

function extractDate(text: string): FieldResult<string> {
  const keywordMatch = text.match(/(?:datum|date|rechnungsdatum|belegdatum|invoice date|stay date)[:\s]*(\d{1,2})[./](\d{1,2})[./](20\d{2})/i);
  if (keywordMatch) {
    const [, day, month, year] = keywordMatch;
    return { value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, confidence: "high" };
  }

  const euMatch = text.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return { value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, confidence: "medium" };
    }
  }

  const isoMatch = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (isoMatch) return { value: isoMatch[0], confidence: "medium" };
  return { value: null, confidence: "none" };
}

function extractDateFields(lines: string[], text: string): DateFieldsResult {
  const invoiceDate = extractKeywordDate(lines, [
    /rechnungsdatum/i,
    /invoice\s*date/i,
    /issue\s*date/i,
    /ausstellungsdatum/i,
    /bill\s*date/i,
    /belegdatum/i,
    /^datum\b/i,
  ]);
  const dueDate = extractKeywordDate(lines, [
    /faellig(?:keit|keitsdatum)?/i,
    /zahlbar(?:\s*(?:bis|am|zum))?/i,
    /payment\s*due/i,
    /due\s*date/i,
    /due\s*on/i,
    /payable\s*(?:until|by)/i,
  ]);
  const serviceDate = extractKeywordDate(lines, [
    /leistungsdatum/i,
    /leistungszeitraum/i,
    /leistung\s+am/i,
    /lieferdatum/i,
    /service\s*date/i,
    /delivery\s*date/i,
  ]);
  const fallbackDate = extractDate(text);

  return {
    invoiceDate,
    dueDate,
    serviceDate,
    date: invoiceDate.value ? invoiceDate : fallbackDate,
  };
}

function extractKeywordDate(lines: string[], patterns: RegExp[]): FieldResult<string> {
  for (const line of lines.slice(0, 40)) {
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    const matched = parseDateFromText(line);
    if (matched) {
      const highConfidence = patterns.some((pattern) => /rechnungsdatum|leistungsdatum|leistungszeitraum|invoice|service/i.test(pattern.source));
      return {
        value: matched,
        confidence: highConfidence ? "high" : "medium",
      };
    }
  }

  return { value: null, confidence: "none" };
}

function parseDateFromText(text: string): string | null {
  const euMatch = text.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const compactMatch = text.match(/\b(\d{2})(\d{2})(20\d{2})\b/);
  if (compactMatch) {
    const [, day, month, year] = compactMatch;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  return null;
}

function extractTime(text: string): FieldResult<string> {
  const keywordMatch = text.match(/(?:uhr|zeit|time|entry|exit|check-?in|check-?out)[:\s]*(\d{1,2}:\d{2})/i);
  if (keywordMatch) return { value: normalizeTime(keywordMatch[1]), confidence: "high" };

  const generic = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (generic) return { value: `${generic[1].padStart(2, "0")}:${generic[2]}`, confidence: "medium" };
  return { value: null, confidence: "none" };
}

function extractAmount(text: string): FieldResult<number> {
  const lines = text.split("\n");
  const totalKw = /(?:summe|gesamt|total|brutto|zu\s*zahlen|betrag|endbetrag|rechnungsbetrag|amount due|grand total|total due)/i;

  for (const line of lines) {
    if (totalKw.test(line)) {
      const amount = parseAmountFromLine(line);
      if (amount !== null && amount > 0) return { value: amount, confidence: "high" };
    }
  }

  const all = extractAllAmounts(text);
  if (all.length > 0) {
    return {
      value: Math.max(...all),
      confidence: all.length === 1 ? "medium" : "low",
    };
  }

  return { value: null, confidence: "none" };
}

function extractAmountFields(lines: string[], text: string): AmountFieldsResult {
  const grossAmount = extractAmountByPatterns(lines, [
    /grand\s*total/i,
    /total\s*due/i,
    /gesamtbetrag/i,
    /endbetrag/i,
    /rechnungsbetrag/i,
    /zu\s*zahlen/i,
    /brutto/i,
    /gesamt/i,
    /summe/i,
    /total/i,
  ]);
  const netAmount = extractAmountByPatterns(lines, [
    /netto/i,
    /net\s*amount/i,
    /subtotal/i,
    /zwischensumme/i,
    /warenwert/i,
  ]);
  const taxCandidates = extractMultipleAmountsByPatterns(lines, [
    /mwst/i,
    /mehrwertsteuer/i,
    /umsatzsteuer/i,
    /ust\.?/i,
    /vat/i,
    /tax/i,
  ]);
  const taxAmount = collapseTaxAmounts(taxCandidates);
  const fallbackAmount = extractAmount(text);
  const derivedGrossAmount = deriveGrossAmount({ grossAmount, netAmount, taxAmount, fallbackAmount });
  const primaryAmount = derivedGrossAmount.value !== null ? derivedGrossAmount : fallbackAmount;

  const adjustedGrossAmount = primaryAmount.value !== null && grossAmount.value === null
    ? primaryAmount
    : grossAmount;

  return {
    amount: primaryAmount,
    grossAmount: adjustedGrossAmount,
    netAmount,
    taxAmount,
  };
}

function extractAmountByPatterns(lines: string[], patterns: RegExp[]): FieldResult<number> {
  for (const line of lines) {
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    const amount = parseAmountFromLine(line);
    if (amount !== null && amount > 0) {
      const highConfidence = patterns.some((pattern) => /grand|total|gesamtbetrag|endbetrag|rechnungsbetrag|brutto|netto|subtotal|zwischensumme|mwst|mehrwertsteuer|umsatzsteuer|vat|tax/i.test(pattern.source));
      return { value: amount, confidence: highConfidence ? "high" : "medium" };
    }
  }

  return { value: null, confidence: "none" };
}

function extractMultipleAmountsByPatterns(lines: string[], patterns: RegExp[]): number[] {
  const amounts: number[] = [];

  for (const line of lines) {
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    const amount = parseAmountFromLine(line);
    if (amount !== null && amount > 0) amounts.push(amount);
  }

  return amounts;
}

function collapseTaxAmounts(amounts: number[]): FieldResult<number> {
  if (amounts.length === 0) return { value: null, confidence: "none" };
  if (amounts.length === 1) return { value: amounts[0], confidence: "high" };

  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return { value: Number(total.toFixed(2)), confidence: "medium" };
}

function deriveGrossAmount({
  grossAmount,
  netAmount,
  taxAmount,
  fallbackAmount,
}: {
  grossAmount: FieldResult<number>;
  netAmount: FieldResult<number>;
  taxAmount: FieldResult<number>;
  fallbackAmount: FieldResult<number>;
}): FieldResult<number> {
  if (grossAmount.value !== null) return grossAmount;

  if (netAmount.value !== null && taxAmount.value !== null) {
    return {
      value: Number((netAmount.value + taxAmount.value).toFixed(2)),
      confidence: netAmount.confidence === "high" && taxAmount.confidence === "high" ? "medium" : "low",
    };
  }

  return fallbackAmount;
}

function parseAmountFromLine(line: string): number | null {
  const eu = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2,3})/);
  if (eu) return parseFloat(eu[1].replace(/\./g, "").replace(",", "."));
  const us = line.match(/(\d+\.\d{2,3})/);
  if (us) return parseFloat(us[1]);
  return null;
}

function extractAllAmounts(text: string): number[] {
  const amounts: number[] = [];
  const euRegex = /(\d{1,3}(?:\.\d{3})*,\d{2,3})\b/g;
  let match: RegExpExecArray | null;
  while ((match = euRegex.exec(text)) !== null) {
    const value = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(value) && value > 0) amounts.push(value);
  }

  if (amounts.length === 0) {
    const usRegex = /(\d+\.\d{2,3})\b/g;
    while ((match = usRegex.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      if (!Number.isNaN(value) && value > 0) amounts.push(value);
    }
  }

  return amounts;
}

function extractCurrency(text: string): FieldResult<string> {
  const upper = text.toUpperCase();
  const explicit = text.match(new RegExp(`\\d[,.]?\\d{2}\\s*(${SUPPORTED_CURRENCIES.join("|")})\\b`, "i"));
  if (explicit) return { value: explicit[1].toUpperCase(), confidence: "high" };
  if (upper.includes("EUR") || text.includes("€")) return { value: "EUR", confidence: "high" };
  if (upper.includes("CHF")) return { value: "CHF", confidence: "high" };
  if (upper.includes("RSD")) return { value: "RSD", confidence: "medium" };
  if (upper.includes("MKD")) return { value: "MKD", confidence: "medium" };
  if (upper.includes("USD") || text.includes("$")) return { value: "USD", confidence: "medium" };
  if (upper.includes("GBP") || text.includes("£")) return { value: "GBP", confidence: "medium" };
  return { value: null, confidence: "none" };
}

function extractSupplier(lines: string[]): FieldResult<string> {
  const supplierExclusion = /(rechnungsempfaenger|leistungsempfaenger|kunde|kundennummer|bill to|ship to|lieferadresse|empfaenger|customer|client|recipient|anschrift des kunden)/i;
  const companyHints = /(gmbh|ug\b|ag\b|kg\b|ohg\b|gbr\b|e\.k\.?|ek\b|inc\.?|llc\b|ltd\.?|s\.r\.o\.?|sarl|sas|corp\.?|company|co\.?\b)/i;
  const taxHints = /(ust-?id|uid|vat|tax\s*id|steuer-?nr|handelsregister|iban|bic|tel\.?|telefon|www\.|@)/i;

  const candidates = lines.slice(0, 18)
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.length >= 3)
    .filter(({ line }) => !LOCATION_NOISE.test(line))
    .filter(({ line }) => !supplierExclusion.test(line))
    .filter(({ line }) => !INVOICE_SECTION_END.test(line));

  let best: { value: string; score: number } | null = null;

  for (const { line, index } of candidates) {
    const clean = line.slice(0, 255).trim();
    const normalized = clean
      .replace(/\b([A-Za-z]+)(GmbH|mbH|UG|AG|KG|OHG|GbR|LLC|Ltd)\b/g, "$1 $2")
      .replace(/\bG\s*mbH\b/g, "GmbH")
      .replace(/\bU\s*G\b/g, "UG")
      .replace(/\s{2,}/g, " ");
    const alphaCount = clean.replace(/[^A-Za-z]/g, "").length;
    const alphaRatio = alphaCount / Math.max(clean.length, 1);
    if (alphaRatio < 0.35) continue;

    let score = 0;
    if (index <= 3) score += 3;
    else if (index <= 7) score += 2;
    else score += 1;

    if (companyHints.test(normalized)) score += 4;
    if (/[A-Z][A-Za-z&.,' -]{3,}/.test(normalized)) score += 2;
    if (/^[A-Z0-9][A-Za-z&.,'()\- ]+$/.test(normalized)) score += 1;
    if (normalized.length > 60) score -= 1;
    if (/\d{5}\s+[A-Za-z]/.test(normalized)) score -= 1;
    if (/^(rechnung|invoice|beleg|receipt|tax invoice)\b/i.test(normalized)) score -= 4;
    if (taxHints.test(normalized)) score -= 2;
    if (parseAmountFromLine(normalized) !== null) score -= 3;

    const nextLine = lines[index + 1] ?? "";
    if (taxHints.test(nextLine)) score += 2;

    if (!best || score > best.score) {
      best = { value: normalized, score };
    }
  }

  if (!best || best.score < 3) return { value: null, confidence: "none" };
  return { value: best.value, confidence: best.score >= 7 ? "high" : "medium" };
}

function extractInvoiceNumber(lines: string[]): FieldResult<string> {
  const patterns: Array<{ pattern: RegExp; confidence: OcrConfidenceLevel }> = [
    {
      pattern: /(?:re(?:chnungs)?[\s.-]?(?:nr|nummer)|rechnungs(?:nr|nummer)?|invoice\s*(?:nr|no|number)?|inv[\s.-]?(?:nr|no)|beleg(?:nr|nummer)?|bon(?:nr|nummer)?|receipt\s*(?:nr|no|number)?|ref(?:erenz)?)[\s.:#-]*([A-Z0-9][A-Z0-9\/ .-]{2,39})/i,
      confidence: "high",
    },
    {
      pattern: /\b(?:nr|no)\.?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/ .-]{2,39})\b/i,
      confidence: "medium",
    },
  ];

  for (const line of lines.slice(0, 25)) {
    for (const { pattern, confidence } of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const value = match[1].replace(/[.,;:]$/, "").trim();
      const normalizedValue = value
        .replace(/[. ]+/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-|-$/g, "");
      if (normalizedValue.length < 3) continue;
      if (/^(datum|date|total|summe|eur)$/i.test(normalizedValue)) continue;
      return { value: normalizedValue.slice(0, 40), confidence };
    }
  }

  return { value: null, confidence: "none" };
}

function extractLocation(lines: string[]): FieldResult<string> {
  for (const line of lines.slice(0, 15)) {
    if (LOCATION_NOISE.test(line)) continue;
    if (/\b\d{4,5}\s+[A-Za-z]/.test(line) || /\b[A-Z][a-z]+\s*,\s*[A-Z][a-z]+/.test(line)) {
      return { value: line.slice(0, 255), confidence: "medium" };
    }
  }
  return { value: null, confidence: "none" };
}

function extractPaymentMethod(text: string): FieldResult<OcrPaymentMethod> {
  const normalized = text.toLowerCase();
  const hasCash = /\bbar\b|cash|cash payment/.test(normalized);
  const hasCredit = /visa|master\s*card|mastercard|amex|american express|credit/.test(normalized);
  const hasDebit = /debit|ec\s*-?karte|girocard|maestro/.test(normalized);
  const hasCardGeneric = /karte|card|kontaktlos|apple pay|google pay|terminal|zahlung mit karte/.test(normalized);

  if (hasCash && !hasCredit && !hasDebit && !hasCardGeneric) {
    return { value: "cash", confidence: "high" };
  }
  if (hasCredit) {
    return { value: "credit_card", confidence: /visa|master\s*card|mastercard|amex/.test(normalized) ? "high" : "medium" };
  }
  if (hasDebit) {
    return { value: "debit_card", confidence: /girocard|ec\s*-?karte|maestro/.test(normalized) ? "high" : "medium" };
  }
  if (hasCardGeneric) {
    return { value: "unknown", confidence: "low" };
  }
  return { value: null, confidence: "none" };
}

function extractCardLastDigits(text: string, paymentMethod: FieldResult<OcrPaymentMethod>): FieldResult<string> {
  if (paymentMethod.value === "cash" || paymentMethod.value === null) {
    return { value: null, confidence: "none" };
  }

  const patterns = [
    /(?:a[.-]?id|last\s*digits|endziffern?|karte|card|visa|master\s*card|mastercard|girocard|ec)[^\d]{0,20}(?:\*{2,}|x{2,}|#{2,}|ending in\s*)?(\d{2,4})\b/i,
    /(?:\*{2,}|x{2,}|#{2,})\s*(\d{2,4})\b/i,
    /\b(?:card|karte)\s*(\d{2,4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const digits = match[1];
    if (digits.length < 2 || digits.length > 4) continue;
    return { value: digits, confidence: digits.length === 4 ? "medium" : "low" };
  }

  return { value: null, confidence: "none" };
}

function extractFuelDetails(text: string, amount: FieldResult<number>): FuelDetails | null {
  const liters = extractFuelLiters(text);
  const pricePerLiter = extractPricePerLiter(text);
  const fuelType = extractFuelType(text);

  if ([liters.confidence, pricePerLiter.confidence, fuelType.confidence].every((level) => level === "none")) {
    return null;
  }

  return {
    liters,
    pricePerLiter,
    fuelType,
    totalAmount: amount,
  };
}

function extractFuelLiters(text: string): FieldResult<number> {
  const match = text.match(/(\d{1,3}[,.]\d{2,3})\s*(?:l|lt|ltr|liter)\b/i);
  if (!match) return { value: null, confidence: "none" };
  return { value: parseLocaleNumber(match[1]), confidence: /liter|ltr/i.test(match[0]) ? "high" : "medium" };
}

function extractPricePerLiter(text: string): FieldResult<number> {
  const match = text.match(/(\d{1,2}[,.]\d{3})\s*(?:eur\/?l|€\/?l|\/l|pro\s*l|je\s*l)/i)
    ?? text.match(/(?:eur\/?l|€\/?l|\/l|pro\s*l|je\s*l)\s*(\d{1,2}[,.]\d{3})/i);
  if (!match) return { value: null, confidence: "none" };
  return { value: parseLocaleNumber(match[1]), confidence: "medium" };
}

function extractFuelType(text: string): FieldResult<string> {
  const fuelTypes = ["Diesel", "Super", "Super E10", "Super E5", "Benzin", "LPG", "AdBlue"] as const;
  for (const fuelType of fuelTypes) {
    if (new RegExp(fuelType.replace(/\s+/g, "\\s*"), "i").test(text)) {
      return { value: fuelType, confidence: fuelType === "Diesel" || fuelType === "Benzin" ? "high" : "medium" };
    }
  }
  return { value: null, confidence: "none" };
}

function extractHospitalityDetails(lines: string[], baseLocation: FieldResult<string>): HospitalityDetails {
  const location = baseLocation.value ? baseLocation : extractLocation(lines);
  const subtotal = extractLabeledAmount(lines, [/(zwischensumme|subtotal|netto)/i]);
  const tip = extractLabeledAmount(lines, [/(trinkgeld|tip)/i]);
  const lineItems = extractLineItems(lines);

  return { location, subtotal, tip, lineItems };
}

function extractLodgingDetails(lines: string[], baseLocation: FieldResult<string>): LodgingDetails {
  const location = baseLocation.value ? baseLocation : extractLocation(lines);
  const nights = extractNights(lines.join("\n"));
  const subtotal = extractLabeledAmount(lines, [/(room\s*rate|zimmer|uebernacht|overnight|subtotal|zwischensumme)/i]);
  const tax = extractLabeledAmount(lines, [/(city\s*tax|tourism\s*tax|kurtaxe|tax\b|vat\b)/i]);
  const fees = extractLabeledAmount(lines, [/(service\s*fee|fee\b|gebuehr|service)/i]);
  const lineItems = extractTypedLineItems(lines, /(room|zimmer|night|nacht|breakfast|city\s*tax|tourism|fee|service)/i, 6);

  return { location, nights, subtotal, tax, fees, lineItems };
}

function extractParkingDetails(lines: string[], baseLocation: FieldResult<string>, baseTime: FieldResult<string>): ParkingDetails {
  const location = findMatchingLine(lines, /(parkhaus|parking|parken|garage|parkplatz|car park)/i, 255) ?? baseLocation.value;
  const durationText = extractParkingDuration(lines.join("\n"));
  const { entryTime, exitTime } = extractEntryExitTimes(lines, baseTime);

  return {
    location: toFieldResult(location, location ? "medium" : "none"),
    durationText,
    entryTime,
    exitTime,
  };
}

function extractTollDetails(lines: string[], baseLocation: FieldResult<string>): TollDetails {
  const station = findMatchingLine(lines, /(maut|toll|peage|putarina|station|naplatna|plaza)/i, 255) ?? baseLocation.value;
  const routeHint = findMatchingLine(lines, /(autobahn|autocesta|route|relacija|section|dionica|strecke|abschnitt)/i, 255);
  const vehicleClass = extractVehicleClass(lines.join("\n"));

  return {
    station: toFieldResult(station, station ? "medium" : "none"),
    routeHint: toFieldResult(routeHint, routeHint ? "low" : "none"),
    vehicleClass,
  };
}

function extractLabeledAmount(lines: string[], patterns: RegExp[]): FieldResult<number> {
  for (const line of lines) {
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    const amount = parseAmountFromLine(line);
    if (amount !== null) return { value: amount, confidence: "medium" };
  }
  return { value: null, confidence: "none" };
}

function extractNights(text: string): FieldResult<number> {
  const match = text.match(/(\d{1,2})\s*(?:nacht|naechte|night|nights)\b/i);
  if (!match) return { value: null, confidence: "none" };
  return { value: parseInt(match[1], 10), confidence: "medium" };
}

function extractParkingDuration(text: string): FieldResult<string> {
  const interval = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|bis|to)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if (interval) {
    return { value: `${interval[1].padStart(2, "0")}:${interval[2]} - ${interval[3].padStart(2, "0")}:${interval[4]}`, confidence: "medium" };
  }
  const duration = text.match(/\b(\d+\s*(?:h|min|std|stunden|minuten))\b/i);
  if (duration) {
    return { value: duration[1], confidence: "low" };
  }
  return { value: null, confidence: "none" };
}

function extractEntryExitTimes(lines: string[], baseTime: FieldResult<string>) {
  const entryLine = lines.find((line) => /(entry|einfahrt|check-?in)/i.test(line));
  const exitLine = lines.find((line) => /(exit|ausfahrt|check-?out)/i.test(line));
  const entry = entryLine ? extractTime(entryLine) : { value: null, confidence: "none" as OcrConfidenceLevel };
  const exit = exitLine ? extractTime(exitLine) : { value: null, confidence: "none" as OcrConfidenceLevel };

  return {
    entryTime: entry.value ? entry : { value: null, confidence: "none" as OcrConfidenceLevel },
    exitTime: exit.value ? exit : (entry.value || !baseTime.value ? { value: null, confidence: "none" as OcrConfidenceLevel } : baseTime),
  };
}

function extractVehicleClass(text: string): FieldResult<string> {
  const match = text.match(/(?:class|klasse|kategorie|category|kat\.?)[^A-Za-z0-9]{0,8}([A-Za-z0-9 -]{1,20})/i);
  if (!match) return { value: null, confidence: "none" };
  return { value: match[1].trim(), confidence: "low" };
}

function extractLineItems(lines: string[]): OcrLineItem[] {
  return extractTypedLineItems(lines, /.*/, 5);
}

function extractTypedLineItems(lines: string[], includePattern: RegExp, limit: number): OcrLineItem[] {
  const items: OcrLineItem[] = [];
  for (const line of lines) {
    if (items.length >= limit) break;
    if (LINE_ITEM_SKIP.test(line)) continue;
    if (!includePattern.test(line)) continue;
    if (line.length < 4) continue;
    const amount = parseAmountFromLine(line);
    if (amount === null) continue;

    const label = line
      .replace(/(\d{1,3}(?:\.\d{3})*,\d{2,3}|\d+\.\d{2,3})/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (label.length < 2 || /^\d+$/.test(label)) continue;
    items.push({ label: label.slice(0, 120), amount });
  }
  return items;
}

function extractInvoiceDetails(lines: string[], sourceType: OcrSourceType): InvoiceDetails {
  const mode = sourceType === "pdf-text" ? "text" : "scan";
  const candidateLines = collectInvoiceCandidateLines(lines, mode);
  const lineItems: OcrInvoiceLineItem[] = [];
  let pendingDescription: string | null = null;

  for (const line of candidateLines) {
    if (!line) continue;
    if (mode === "text" && shouldBufferInvoiceDescription(line)) {
      pendingDescription = pendingDescription ? `${pendingDescription} ${line}` : line;
      continue;
    }

    const parsed = parseInvoiceLine(line, mode, pendingDescription);
    if (!parsed) continue;
    lineItems.push(parsed);
    pendingDescription = null;
    if (lineItems.length >= (mode === "text" ? 12 : 6)) break;
  }

  return { lineItems };
}

function collectInvoiceCandidateLines(lines: string[], mode: "text" | "scan") {
  const headerIndex = mode === "text"
    ? lines.findIndex((line) => INVOICE_HEADER_KEYWORDS.test(line) && /(preis|amount|gesamt|total|menge|qty|anzahl)/i.test(line))
    : -1;

  const workingLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
  const result: string[] = [];

  for (const line of workingLines) {
    const normalized = line.replace(/\s{2,}/g, " ").trim();
    if (!normalized) continue;
    if (INVOICE_SECTION_END.test(normalized) && hasAnyAmount(normalized)) break;
    if (INVOICE_LINE_SKIP.test(normalized) && !hasAnyAmount(normalized)) continue;
    result.push(normalized);
  }

  return result;
}

function shouldBufferInvoiceDescription(line: string) {
  if (line.length < 4 || line.length > 120) return false;
  if (hasAnyAmount(line)) return false;
  if (INVOICE_SECTION_END.test(line) || INVOICE_LINE_SKIP.test(line)) return false;
  return /[A-Za-z]/.test(line);
}

function parseInvoiceLine(line: string, mode: "text" | "scan", pendingDescription: string | null): OcrInvoiceLineItem | null {
  if (INVOICE_SECTION_END.test(line) || INVOICE_LINE_SKIP.test(line)) return null;

  const amountTokens = extractAmountTokens(line);
  if (amountTokens.length === 0) return null;
  if (mode === "scan" && amountTokens.length > 2) return null;

  const source = pendingDescription ? `${pendingDescription} ${line}` : line;
  const merged = source.replace(/\s{2,}/g, " ").trim();
  const lineNumberMatch = merged.match(/^\s*(\d{1,3})[.)-]?\s+/);
  const lineNumber = lineNumberMatch ? parseInt(lineNumberMatch[1], 10) : null;
  const taxHintMatch = merged.match(/\b(\d{1,2}\s?%)\b/);
  const descriptionPart = merged.slice(0, amountTokens[0].index).replace(/^\s*\d+[.)-]?\s*/, "").trim();
  if (descriptionPart.length < 3) return null;

  const quantityUnit = extractQuantityAndUnit(descriptionPart, mode);
  const description = cleanInvoiceDescription(descriptionPart, quantityUnit.rawSegment);
  if (description.length < 3) return null;

  let unitPrice: number | null = null;
  let totalPrice: number | null = null;
  if (amountTokens.length >= 2) {
    unitPrice = amountTokens[amountTokens.length - 2].value;
    totalPrice = amountTokens[amountTokens.length - 1].value;
  } else {
    totalPrice = amountTokens[0].value;
  }

  if (mode === "scan" && unitPrice !== null && quantityUnit.quantity === null) {
    unitPrice = null;
  }

  const completenessScore = [quantityUnit.quantity !== null, unitPrice !== null, totalPrice !== null].filter(Boolean).length;
  const confidence: OcrConfidenceLevel = mode === "text"
    ? completenessScore >= 2 ? "high" : "medium"
    : completenessScore >= 2 ? "medium" : "low";
  const status: OcrInvoiceLineItemStatus = completenessScore >= 2
    ? (confidence === "high" ? "confident" : "uncertain")
    : "partial";

  return {
    lineNumber,
    description: description.slice(0, 180),
    quantity: quantityUnit.quantity,
    unit: quantityUnit.unit,
    unitPrice,
    totalPrice,
    taxHint: taxHintMatch ? taxHintMatch[1].replace(/\s+/g, "") : null,
    confidence,
    status,
  };
}

function extractAmountTokens(line: string) {
  const tokens: Array<{ raw: string; value: number; index: number }> = [];
  const matches = line.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2,3}|\d+\.\d{2,3})/g);
  for (const match of matches) {
    const raw = match[1];
    const value = parseAmountToken(raw);
    if (Number.isNaN(value) || value <= 0) continue;
    tokens.push({ raw, value, index: match.index ?? 0 });
  }
  return tokens;
}

function hasAnyAmount(line: string) {
  return extractAmountTokens(line).length > 0;
}

function extractQuantityAndUnit(description: string, mode: "text" | "scan") {
  const tailMatch = description.match(/(?:^|\s)(\d+[.,]?\d*)\s*(stk|st\.?|pcs|pc|std|stunden|h|kg|g|m2|m3|m|l|tage|tag|mon|monat)\b/i);
  if (tailMatch) {
    return {
      quantity: parseFloat(tailMatch[1].replace(",", ".")),
      unit: tailMatch[2],
      rawSegment: tailMatch[0].trim(),
    };
  }

  if (mode === "text") {
    const xMatch = description.match(/(?:^|\s)(\d+[.,]?\d*)\s*[xX]\s*$/i);
    if (xMatch) {
      return {
        quantity: parseFloat(xMatch[1].replace(",", ".")),
        unit: null,
        rawSegment: xMatch[0].trim(),
      };
    }
  }

  return { quantity: null, unit: null, rawSegment: null as string | null };
}

function cleanInvoiceDescription(description: string, rawSegment: string | null) {
  let value = description;
  if (rawSegment) {
    value = value.replace(rawSegment, " ");
  }

  return value
    .replace(/\b(pos|position|item)\b\s*:?/i, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractCountry(text: string, currency: FieldResult<string>, location: FieldResult<string>, supplier: FieldResult<string>): CountryResult {
  const haystack = `${text}\n${location.value ?? ""}\n${supplier.value ?? ""}`;
  const scores = COUNTRY_RULES.map((rule) => {
    let score = 0;
    if (rule.keywords.some((pattern) => pattern.test(haystack))) score += 2;
    if (rule.vat.test(haystack)) score += 3;
    if (rule.phone.test(haystack)) score += 2;
    if (rule.postal.test(haystack)) score += 1;
    if (currency.value) {
      if (currency.value === "RSD" && rule.code === "RS") score += 4;
      if (currency.value === "MKD" && rule.code === "MK") score += 4;
      if (currency.value === "HRK" && rule.code === "HR") score += 2;
    }
    return { ...rule, score };
  }).sort((left, right) => right.score - left.score);

  const best = scores[0];
  if (!best || best.score <= 0) {
    return { code: null, name: null, confidence: "none" };
  }
  if (best.score >= 5) {
    return { code: best.code, name: best.name, confidence: "high" };
  }
  return { code: best.code, name: best.name, confidence: "medium" };
}

function detectDocumentType(
  text: string,
  fuel: FuelDetails | null,
  hospitality: HospitalityDetails,
  lodging: LodgingDetails,
  parking: ParkingDetails,
  toll: TollDetails,
): FieldResult<OcrDocumentType> {
  const fuelScore = keywordScore(text, FUEL_KEYWORDS)
    + (fuel?.liters.value ? 2 : 0)
    + (fuel?.pricePerLiter.value ? 2 : 0)
    + (fuel?.fuelType.value ? 2 : 0);

  const hospitalityScore = keywordScore(text, HOSPITALITY_KEYWORDS)
    + (hospitality.tip.value ? 2 : 0)
    + (hospitality.lineItems.length >= 2 ? 1 : 0);

  const lodgingScore = keywordScore(text, LODGING_KEYWORDS)
    + (lodging.nights.value ? 2 : 0)
    + (lodging.tax.value ? 1 : 0)
    + (lodging.lineItems.length > 0 ? 1 : 0);

  const parkingScore = keywordScore(text, PARKING_KEYWORDS)
    + (parking.durationText.value ? 2 : 0)
    + (parking.entryTime.value || parking.exitTime.value ? 1 : 0);

  const tollScore = keywordScore(text, TOLL_KEYWORDS)
    + (toll.station.value ? 2 : 0)
    + (toll.routeHint.value ? 1 : 0)
    + (toll.vehicleClass.value ? 1 : 0);

  const candidates: Array<{ value: OcrDocumentType; score: number }> = [
    { value: "fuel" as OcrDocumentType, score: fuelScore },
    { value: "hospitality" as OcrDocumentType, score: hospitalityScore },
    { value: "lodging" as OcrDocumentType, score: lodgingScore },
    { value: "parking" as OcrDocumentType, score: parkingScore },
    { value: "toll" as OcrDocumentType, score: tollScore },
  ].sort((left, right) => right.score - left.score);

  const best = candidates[0];
  if (!best || best.score < 3) {
    return { value: "general", confidence: "low" };
  }

  return { value: best.value, confidence: best.score >= 5 ? "high" : "medium" };
}

function keywordScore(text: string, patterns: RegExp[]) {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

function parseLocaleNumber(value: string) {
  if (value.includes(",")) {
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(value);
}

function parseAmountToken(value: string) {
  return value.includes(",")
    ? parseFloat(value.replace(/\./g, "").replace(",", "."))
    : parseFloat(value);
}

function normalizeTime(value: string) {
  const [hours, minutes] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
}

function toFieldResult<T>(value: T | null, confidence: OcrConfidenceLevel): FieldResult<T> {
  return { value, confidence };
}

function findMatchingLine(lines: string[], pattern: RegExp, maxLength: number) {
  const match = lines.find((line) => pattern.test(line) && !LOCATION_NOISE.test(line));
  return match ? match.slice(0, maxLength) : null;
}

function hasFuelSignals(value: FuelDetails | null) {
  if (!value) return false;
  return [value.liters.confidence, value.pricePerLiter.confidence, value.fuelType.confidence].some((level) => level !== "none");
}

function hasHospitalitySignals(value: HospitalityDetails) {
  return value.location.confidence !== "none"
    || value.subtotal.confidence !== "none"
    || value.tip.confidence !== "none"
    || value.lineItems.length > 0;
}

function hasLodgingSignals(value: LodgingDetails) {
  return value.location.confidence !== "none"
    || value.nights.confidence !== "none"
    || value.subtotal.confidence !== "none"
    || value.tax.confidence !== "none"
    || value.fees.confidence !== "none"
    || value.lineItems.length > 0;
}

function hasParkingSignals(value: ParkingDetails) {
  return value.location.confidence !== "none"
    || value.durationText.confidence !== "none"
    || value.entryTime.confidence !== "none"
    || value.exitTime.confidence !== "none";
}

function hasTollSignals(value: TollDetails) {
  return value.station.confidence !== "none"
    || value.routeHint.confidence !== "none"
    || value.vehicleClass.confidence !== "none";
}
