import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { getOrganizationProfileDto } from "@/lib/organization";

const organizationSchema = z.object({
  legalName: z.string().max(255, "Firmenname zu lang."),
  tradeName: z.string().max(255).optional().nullable(),
  vatId: z.string().max(40).optional().nullable(),
  street: z.string().max(255).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  countryCode: z.string().max(2).optional().nullable(),
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

  const legalName = parsed.data.legalName.trim();
  const tradeName = emptyToNull(parsed.data.tradeName);
  const vatId = emptyToNull(parsed.data.vatId);
  const street = emptyToNull(parsed.data.street);
  const zip = emptyToNull(parsed.data.zip);
  const city = emptyToNull(parsed.data.city);
  const countryCode = emptyToNull(parsed.data.countryCode)?.toUpperCase() ?? null;

  const profile = await prisma.organizationProfile.upsert({
    where: { id: "default" },
    update: {
      legalName,
      tradeName,
      vatId,
      street,
      zip,
      city,
      countryCode,
    },
    create: {
      id: "default",
      legalName,
      tradeName,
      vatId,
      street,
      zip,
      city,
      countryCode,
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
    updatedAt: profile.updatedAt.toISOString(),
  });
}
