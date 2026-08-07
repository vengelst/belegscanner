import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { getOrganizationProfileDto } from "@/lib/organization";
import {
  DATEV_BELEGTYP_VALUES,
  DEFAULT_COMPANY_CARD_LAST_DIGITS,
  DEFAULT_DATEV_BELEGTYP,
  normalizeDatevBelegtypLabelOverrides,
} from "@/lib/datev/belegtyp";

/**
 * Alle Felder sind optional: Firmenidentitaet, Firmenkarten und Belegtyp-
 * Einstellungen werden in getrennten Formularen gepflegt und duerfen sich
 * gegenseitig nicht ueberschreiben.
 */
const organizationSchema = z.object({
  legalName: z.string().max(255, "Firmenname zu lang.").optional(),
  tradeName: z.string().max(255).optional().nullable(),
  vatId: z.string().max(40).optional().nullable(),
  street: z.string().max(255).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  countryCode: z.string().max(2).optional().nullable(),
  // Nur Endziffern - vollstaendige Kartennummern werden bewusst nicht gespeichert.
  companyCardLastDigits: z
    .array(z.string().regex(/^\d{2,4}$/, "Endziffern muessen aus 2 bis 4 Ziffern bestehen."))
    .max(20, "Maximal 20 Firmenkarten.")
    .optional(),
  defaultDatevBelegtyp: z.enum(DATEV_BELEGTYP_VALUES).optional(),
  // Leere Werte bedeuten "DATEV-Standardname" und werden nicht gespeichert.
  datevBelegtypLabelOverrides: z
    .record(z.string(), z.string().max(120, "Bezeichnung zu lang (max. 120 Zeichen)."))
    .optional(),
});

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const profile = await getOrganizationProfileDto();
  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = organizationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Nur uebermittelte Felder werden geschrieben - so laesst das Firmenkarten-Formular
  // die Identitaetsfelder unangetastet und umgekehrt.
  const identity = parsed.data.legalName !== undefined
    ? {
        legalName: parsed.data.legalName.trim(),
        tradeName: emptyToNull(parsed.data.tradeName),
        vatId: emptyToNull(parsed.data.vatId),
        street: emptyToNull(parsed.data.street),
        zip: emptyToNull(parsed.data.zip),
        city: emptyToNull(parsed.data.city),
        countryCode: emptyToNull(parsed.data.countryCode)?.toUpperCase() ?? null,
      }
    : null;

  // Doppelte Endziffern zusammenfassen; ein fehlendes Feld laesst die Karten unveraendert.
  const companyCardLastDigits = parsed.data.companyCardLastDigits
    ? Array.from(new Set(parsed.data.companyCardLastDigits))
    : undefined;

  // Unbekannte Belegtypen und leere Bezeichnungen fallen hier heraus.
  const labelOverrides = parsed.data.datevBelegtypLabelOverrides
    ? normalizeDatevBelegtypLabelOverrides(parsed.data.datevBelegtypLabelOverrides)
    : undefined;

  const profile = await prisma.organizationProfile.upsert({
    where: { id: "default" },
    update: {
      ...(identity ?? {}),
      ...(companyCardLastDigits ? { companyCardLastDigits } : {}),
      ...(parsed.data.defaultDatevBelegtyp ? { defaultDatevBelegtyp: parsed.data.defaultDatevBelegtyp } : {}),
      ...(labelOverrides ? { datevBelegtypLabelOverrides: labelOverrides } : {}),
    },
    create: {
      id: "default",
      legalName: identity?.legalName ?? "",
      tradeName: identity?.tradeName ?? null,
      vatId: identity?.vatId ?? null,
      street: identity?.street ?? null,
      zip: identity?.zip ?? null,
      city: identity?.city ?? null,
      countryCode: identity?.countryCode ?? null,
      companyCardLastDigits: companyCardLastDigits ?? DEFAULT_COMPANY_CARD_LAST_DIGITS,
      defaultDatevBelegtyp: parsed.data.defaultDatevBelegtyp ?? DEFAULT_DATEV_BELEGTYP,
      datevBelegtypLabelOverrides: labelOverrides ?? {},
    },
  });

  return NextResponse.json({
    id: profile.id,
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    vatId: profile.vatId,
    street: profile.street,
    zip: profile.zip,
    city: profile.city,
    countryCode: profile.countryCode,
    companyCardLastDigits: profile.companyCardLastDigits,
    defaultDatevBelegtyp: profile.defaultDatevBelegtyp,
    datevBelegtypLabelOverrides: normalizeDatevBelegtypLabelOverrides(profile.datevBelegtypLabelOverrides),
    updatedAt: profile.updatedAt.toISOString(),
  });
}
