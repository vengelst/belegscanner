import { prisma } from "@/lib/prisma";

/**
 * Interne Default-Kategorie.
 *
 * Die Kategorie ist aus der Oberflaeche verschwunden - der Nutzer pflegt nur noch
 * den DATEV-Belegtyp. `Receipt.categoryId` bleibt im Schema aber ein Pflichtfeld,
 * damit die Migration klein bleibt. Beim Anlegen eines Belegs wird deshalb still
 * auf eine Default-Kategorie gemappt.
 */
const FALLBACK_CATEGORY_NAME = "Sonstiges";

/** Reihenfolge der bevorzugten Namen fuer die Default-Kategorie. */
const PREFERRED_NAMES = [FALLBACK_CATEGORY_NAME, "Kasse"];

export async function resolveDefaultCategoryId(): Promise<string> {
  for (const name of PREFERRED_NAMES) {
    const match = await prisma.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (match) return match.id;
  }

  const firstActive = await prisma.category.findFirst({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (firstActive) return firstActive.id;

  const anyCategory = await prisma.category.findFirst({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (anyCategory) return anyCategory.id;

  // Leere Installation: eine unsichtbare Default-Kategorie anlegen.
  const created = await prisma.category.upsert({
    where: { name: FALLBACK_CATEGORY_NAME },
    update: {},
    create: { name: FALLBACK_CATEGORY_NAME, sortOrder: 999 },
    select: { id: true },
  });
  return created.id;
}
