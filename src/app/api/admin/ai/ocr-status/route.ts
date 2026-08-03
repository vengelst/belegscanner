import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-auth";
import { getOcrServiceUrl } from "@/lib/ai";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const baseUrl = await getOcrServiceUrl();
  if (!baseUrl) {
    return NextResponse.json({
      available: false,
      url: null,
      message: "OCR-Service URL ist nicht konfiguriert.",
    });
  }

  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      return NextResponse.json({
        available: false,
        url: baseUrl,
        message: `OCR-Service antwortet mit HTTP ${response.status}.`,
      });
    }

    const data = (await response.json().catch(() => null)) as { status?: string } | null;
    const ok = data?.status === "ok" || response.ok;

    return NextResponse.json({
      available: ok,
      url: baseUrl,
      message: ok
        ? `OCR-Service erreichbar unter ${baseUrl}.`
        : `OCR-Service antwortet, Status unerwartet: ${JSON.stringify(data)}`,
      health: data,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      available: false,
      url: baseUrl,
      message: `OCR-Service nicht erreichbar (${reason}). Pruefen Sie URL und Docker-Netzwerk.`,
    });
  }
}
