import type { OrganizationIdentity } from "@/lib/organization";
import {
  formatOrganizationAddress,
  isOrganizationConfigured,
  matchesOrganization,
} from "@/lib/organization";
import type { ExtractionResult } from "./types";

export type ExtractedPartyRole = "CREDITOR" | "DEBTOR" | null;

const BASE_RULES = `Rules:
- grossAmount is the final payable amount
- netAmount is the amount before tax
- taxAmount is the total tax amount
- paymentMethod must detect cash, Visa, Mastercard, PayPal, SEPA direct debit, bank transfer or generic card when visible
- All dates must be YYYY-MM-DD when possible
- Currency must be ISO 4217 like EUR or USD
- documentType must be one of: general, fuel, hospitality, lodging, parking, toll
- Return null when a field cannot be read confidently
- Add warnings when values are ambiguous or likely incomplete
- Always extract issuerName (document issuer/vendor) and recipientName (bill-to party) when visible`;

const LEGACY_SUPPLIER_RULE = `- Extract the issuer/vendor as supplier, never the bill-to recipient
- partyRole must be null when our company identity is not configured`;

function buildOrganizationContext(org: OrganizationIdentity): string {
  const lines = [
    `Legal name: ${org.legalName.trim()}`,
    org.tradeName?.trim() ? `Trade name: ${org.tradeName.trim()}` : null,
    org.vatId?.trim() ? `VAT ID / USt-IdNr: ${org.vatId.trim()}` : null,
  ];

  const address = formatOrganizationAddress(org);
  if (address) {
    lines.push(`Address: ${address}`);
  }

  return lines.filter(Boolean).join("\n");
}

export function buildSystemPrompt(organization?: OrganizationIdentity | null): string {
  if (!isOrganizationConfigured(organization ?? null)) {
    return `You extract structured data from business receipts and invoices for accounting.

${BASE_RULES}
${LEGACY_SUPPLIER_RULE}`;
  }

  const org = organization as OrganizationIdentity;

  return `You extract structured data from business receipts and invoices for accounting.

Our company identity (used to distinguish incoming vs outgoing invoices):
${buildOrganizationContext(org)}

${BASE_RULES}
- Compare issuerName against our company identity (fuzzy match on legal/trade name and VAT ID)
- If the issuer is our company: this is an OUTGOING invoice (Debitorenrechnung)
  - partyRole = "DEBTOR"
  - supplier = the customer / bill-to recipient (recipientName), NEVER our company name
- Otherwise: this is an INCOMING invoice (Kreditorenrechnung)
  - partyRole = "CREDITOR"
  - supplier = the issuer / vendor (issuerName)
- If the direction is uncertain, choose the best match, set partyRole accordingly, and add a warning`;
}

export function buildExtractionPromptFields(organization?: OrganizationIdentity | null): string {
  const orgEnabled = isOrganizationConfigured(organization ?? null);

  return `{
  "supplier": string | null,
  "partyRole": ${orgEnabled ? '"CREDITOR" | "DEBTOR" | null' : "null"},
  "issuerName": string | null,
  "recipientName": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": string | null (YYYY-MM-DD),
  "dueDate": string | null (YYYY-MM-DD),
  "serviceDate": string | null (YYYY-MM-DD),
  "time": string | null,
  "currency": string | null (ISO 4217),
  "grossAmount": number | null,
  "netAmount": number | null,
  "taxAmount": number | null,
  "paymentMethod": "cash" | "visa" | "mastercard" | "credit_card" | "debit_card" | "paypal" | "sepa" | "bank_transfer" | "unknown" | null,
  "cardLastDigits": string | null,
  "location": string | null,
  "countryCode": string | null,
  "countryName": string | null,
  "documentType": "general" | "fuel" | "hospitality" | "lodging" | "parking" | "toll" | null,
  "lineItems": [{ "description": string, "quantity": number | null, "unit": string | null, "unitPrice": number | null, "totalPrice": number | null, "taxHint": string | null }],
  "warnings": string[]
}`;
}

export function buildExtractionUserPrompt(organization?: OrganizationIdentity | null): string {
  return `Extrahiere die Daten aus dem Beleg und gib sie als JSON zurueck. Das JSON muss exakt diesem Schema entsprechen:
${buildExtractionPromptFields(organization)}

Gib NUR das JSON zurueck, ohne Markdown-Formatierung oder zusaetzlichen Text.`;
}

export function normalizePartyRole(value: unknown): ExtractedPartyRole {
  if (value === "CREDITOR" || value === "DEBTOR") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "CREDITOR" || normalized === "DEBTOR") {
      return normalized;
    }
  }
  return null;
}

export function normalizeExtractionResult(
  raw: ExtractionResult,
  organization?: OrganizationIdentity | null,
): ExtractionResult {
  const warnings = Array.isArray(raw.warnings) ? [...raw.warnings] : [];
  const lineItems = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  const issuerName = raw.issuerName?.trim() || null;
  const recipientName = raw.recipientName?.trim() || null;
  let supplier = raw.supplier?.trim() || null;
  let partyRole = normalizePartyRole(raw.partyRole);

  if (!isOrganizationConfigured(organization ?? null)) {
    // Legacy behaviour: supplier is the issuer; partyRole stays unset.
    if (!supplier && issuerName) {
      supplier = issuerName;
    }
    return {
      ...raw,
      lineItems,
      supplier,
      partyRole: null,
      issuerName,
      recipientName,
      warnings,
    };
  }

  const org = organization as OrganizationIdentity;
  const issuerIsOwn = matchesOrganization(org, issuerName);
  const recipientIsOwn = matchesOrganization(org, recipientName);
  const supplierIsOwn = matchesOrganization(org, supplier);

  if (issuerIsOwn && !recipientIsOwn) {
    partyRole = "DEBTOR";
    supplier = recipientName ?? (supplierIsOwn ? null : supplier);
    if (!supplier) {
      warnings.push("Debitorenrechnung erkannt, aber Kundenname (Empfaenger) unsicher.");
    }
  } else if (recipientIsOwn && !issuerIsOwn) {
    partyRole = "CREDITOR";
    supplier = issuerName ?? (supplierIsOwn ? null : supplier);
  } else if (partyRole === "DEBTOR") {
    if (supplierIsOwn && recipientName) {
      supplier = recipientName;
      warnings.push("supplier zeigte auf die eigene Firma und wurde auf den Empfaenger korrigiert.");
    } else if (!supplier && recipientName) {
      supplier = recipientName;
    }
  } else if (partyRole === "CREDITOR") {
    if (supplierIsOwn && issuerName && !matchesOrganization(org, issuerName)) {
      supplier = issuerName;
      warnings.push("supplier zeigte auf die eigene Firma und wurde auf den Aussteller korrigiert.");
    } else if (!supplier && issuerName) {
      supplier = issuerName;
    }
  } else {
    // No clear AI direction: fall back to issuer-as-supplier (incoming).
    partyRole = "CREDITOR";
    if (!supplier || supplierIsOwn) {
      supplier = issuerName ?? (supplierIsOwn ? null : supplier);
    }
    if (issuerIsOwn || recipientIsOwn || supplierIsOwn) {
      warnings.push("Belegrichtung unsicher; Fallback auf Kreditor (Eingangsbeleg).");
    }
  }

  if (partyRole === "DEBTOR" && supplier && matchesOrganization(org, supplier)) {
    supplier = recipientName;
    warnings.push("Bei Debitorenrechnung darf supplier nicht die eigene Firma sein.");
  }

  if (partyRole === "CREDITOR" && supplier && matchesOrganization(org, supplier) && issuerName && !matchesOrganization(org, issuerName)) {
    supplier = issuerName;
  }

  return {
    ...raw,
    lineItems,
    supplier,
    partyRole,
    issuerName,
    recipientName,
    warnings,
  };
}
