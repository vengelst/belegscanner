import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY_CARD_LAST_DIGITS } from "@/lib/datev/belegtyp";

export type OrganizationIdentity = {
  legalName: string;
  tradeName: string | null;
  vatId: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  countryCode: string | null;
};

export type OrganizationProfileDto = OrganizationIdentity & {
  id: string;
  /** Endziffern der Firmenkarten (2-4 Ziffern, keine vollstaendigen Kartennummern). */
  companyCardLastDigits: string[];
  updatedAt: string | null;
};

const EMPTY_IDENTITY: OrganizationIdentity = {
  legalName: "",
  tradeName: null,
  vatId: null,
  street: null,
  zip: null,
  city: null,
  countryCode: null,
};

export function isOrganizationConfigured(org: OrganizationIdentity | null | undefined): boolean {
  return Boolean(org?.legalName?.trim());
}

export async function getOrganizationProfile(): Promise<OrganizationIdentity | null> {
  const profile = await prisma.organizationProfile.findUnique({
    where: { id: "default" },
  });

  if (!profile) return null;

  return {
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    vatId: profile.vatId,
    street: profile.street,
    zip: profile.zip,
    city: profile.city,
    countryCode: profile.countryCode,
  };
}

export async function getOrganizationProfileDto(): Promise<OrganizationProfileDto> {
  const profile = await prisma.organizationProfile.findUnique({
    where: { id: "default" },
  });

  if (!profile) {
    return {
      id: "default",
      ...EMPTY_IDENTITY,
      companyCardLastDigits: [...DEFAULT_COMPANY_CARD_LAST_DIGITS],
      updatedAt: null,
    };
  }

  return {
    id: profile.id,
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    vatId: profile.vatId,
    street: profile.street,
    zip: profile.zip,
    city: profile.city,
    countryCode: profile.countryCode,
    companyCardLastDigits: profile.companyCardLastDigits,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * Endziffern der Firmenkarten fuer die Belegtyp-Erkennung.
 *
 * Ohne angelegtes Firmenprofil greifen die Standard-Karten, damit eine frische
 * Installation nicht ohne Kreditkarten-Erkennung dasteht.
 */
export async function getCompanyCardLastDigits(): Promise<string[]> {
  const profile = await prisma.organizationProfile.findUnique({
    where: { id: "default" },
    select: { companyCardLastDigits: true },
  });

  if (!profile) return [...DEFAULT_COMPANY_CARD_LAST_DIGITS];
  return profile.companyCardLastDigits;
}

export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(gmbh|mbh|ag|kg|ug|haftungsbeschraenkt|haftungsbeschrankt|ltd|llc|inc|co|se|ohg|eg)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeVatId(value: string): string {
  return value.replace(/[\s.\-/]/g, "").toUpperCase();
}

export function namesLikelyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const left = normalizeCompanyName(a);
  const right = normalizeCompanyName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftCompact = left.replace(/\s+/g, "");
  const rightCompact = right.replace(/\s+/g, "");
  if (leftCompact === rightCompact) return true;
  if (leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact)) {
    // Avoid short accidental substring hits (e.g. "ag" inside longer names).
    if (Math.min(leftCompact.length, rightCompact.length) >= 5) return true;
  }

  const leftTokens = new Set(left.split(" ").filter((token) => token.length >= 3));
  const rightTokens = right.split(" ").filter((token) => token.length >= 3);
  if (leftTokens.size === 0 || rightTokens.length === 0) return false;
  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  return overlap >= Math.min(2, rightTokens.length) && overlap / Math.max(leftTokens.size, rightTokens.length) >= 0.5;
}

export function vatIdsLikelyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return normalizeVatId(a) === normalizeVatId(b);
}

export function matchesOrganization(
  org: OrganizationIdentity,
  candidateName: string | null | undefined,
  candidateVatId?: string | null,
): boolean {
  if (!isOrganizationConfigured(org)) return false;

  if (vatIdsLikelyMatch(org.vatId, candidateVatId)) return true;

  if (org.vatId?.trim() && candidateName?.trim()) {
    const orgVat = normalizeVatId(org.vatId);
    const haystack = normalizeVatId(candidateName);
    if (orgVat.length >= 8 && haystack.includes(orgVat)) return true;
  }

  const orgNames = [org.legalName, org.tradeName].filter(Boolean) as string[];
  return orgNames.some((name) => namesLikelyMatch(name, candidateName));
}

export function formatOrganizationAddress(org: OrganizationIdentity): string | null {
  const line = [org.street, [org.zip, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (!line && !org.countryCode) return null;
  return [line || null, org.countryCode].filter(Boolean).join(", ");
}
