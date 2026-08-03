import { prisma } from "@/lib/prisma";

export type DuplicateCandidate = {
  id: string;
  date: string;
  supplier: string | null;
  amount: number;
  currency: string;
  invoiceNumber: string | null;
  score: number;
};

export type DuplicateCheckParams = {
  date: string;
  amount: number;
  supplier?: string | null;
  invoiceNumber?: string | null;
  userId: string;
  excludeReceiptId?: string;
};

function normalizeSupplier(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dateDiffDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.abs(a.getTime() - b.getTime()) / msPerDay;
}

function amountMatches(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

function supplierSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

export async function findDuplicateCandidates(
  params: DuplicateCheckParams,
): Promise<DuplicateCandidate[]> {
  const { date, amount, supplier, invoiceNumber, userId, excludeReceiptId } = params;

  const targetDate = new Date(date);
  const dateFrom = new Date(targetDate.getTime() - 2 * 86_400_000);
  const dateTo = new Date(targetDate.getTime() + 2 * 86_400_000);

  const where: Record<string, unknown> = {
    deletedAt: null,
    userId,
    date: { gte: dateFrom, lte: dateTo },
  };

  if (excludeReceiptId) {
    where.id = { not: excludeReceiptId };
  }

  const candidates = await prisma.receipt.findMany({
    where,
    select: {
      id: true,
      date: true,
      supplier: true,
      amount: true,
      currency: true,
      invoiceNumber: true,
    },
    take: 50,
  });

  const normalizedInputSupplier = normalizeSupplier(supplier);
  const normalizedInputInvoice = invoiceNumber?.trim().toLowerCase() || "";

  const scored: DuplicateCandidate[] = [];

  for (const candidate of candidates) {
    let score = 0;
    const candidateAmount = Number(candidate.amount);
    const candidateDate = new Date(candidate.date);

    if (amountMatches(amount, candidateAmount)) {
      score += 40;
    } else {
      continue;
    }

    const dayDiff = dateDiffDays(targetDate, candidateDate);
    if (dayDiff === 0) {
      score += 30;
    } else if (dayDiff <= 1) {
      score += 20;
    } else {
      score += 10;
    }

    const normalizedCandidateSupplier = normalizeSupplier(candidate.supplier);
    if (normalizedInputSupplier && normalizedCandidateSupplier) {
      if (supplierSimilar(normalizedInputSupplier, normalizedCandidateSupplier)) {
        score += 20;
      }
    }

    if (normalizedInputInvoice && candidate.invoiceNumber) {
      const normalizedCandidateInvoice = candidate.invoiceNumber.trim().toLowerCase();
      if (normalizedInputInvoice === normalizedCandidateInvoice) {
        score += 50;
      }
    }

    if (score >= 50) {
      scored.push({
        id: candidate.id,
        date: candidateDate.toISOString().split("T")[0],
        supplier: candidate.supplier,
        amount: candidateAmount,
        currency: candidate.currency,
        invoiceNumber: candidate.invoiceNumber,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}
