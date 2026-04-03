import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { fetchLatestExchangeRate } from "@/lib/exchange-rates";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const currency = request.nextUrl.searchParams.get("currency")?.trim().toUpperCase();
  if (!currency) {
    return NextResponse.json({ error: "Waehrung fehlt." }, { status: 400 });
  }

  try {
    const rate = await fetchLatestExchangeRate(currency);
    return NextResponse.json(rate);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wechselkurs konnte nicht geladen werden.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
