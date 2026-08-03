import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { findDuplicateCandidates } from "@/lib/receipts/duplicate-check";

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const { date, amount, supplier, invoiceNumber, excludeReceiptId } = body as Record<string, unknown>;

  if (!date || typeof date !== "string") {
    return NextResponse.json({ error: "Feld 'date' ist erforderlich." }, { status: 400 });
  }

  if (amount === undefined || amount === null || typeof amount !== "number") {
    return NextResponse.json({ error: "Feld 'amount' ist erforderlich." }, { status: 400 });
  }

  const candidates = await findDuplicateCandidates({
    date,
    amount,
    supplier: typeof supplier === "string" ? supplier : null,
    invoiceNumber: typeof invoiceNumber === "string" ? invoiceNumber : null,
    userId: session.userId,
    excludeReceiptId: typeof excludeReceiptId === "string" ? excludeReceiptId : undefined,
  });

  return NextResponse.json({ candidates });
}
