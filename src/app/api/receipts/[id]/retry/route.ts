import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { sendReceipt } from "@/lib/mail";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) {
    return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });
  }

  if (session.role !== "ADMIN" && receipt.userId !== session.userId) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  // Only allow retry from FAILED or SENT
  if (!["FAILED", "SENT"].includes(receipt.sendStatus)) {
    return NextResponse.json(
      { error: `Erneutes Senden nicht moeglich im Status "${receipt.sendStatus}".` },
      { status: 400 },
    );
  }

  // Parse optional datevProfileId
  let datevProfileId: string | undefined;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.datevProfileId) datevProfileId = String(body.datevProfileId);
  } catch {
    // No body is fine
  }

  // Transition to RETRY
  await prisma.receipt.update({
    where: { id },
    data: { sendStatus: "RETRY", sendStatusUpdatedAt: new Date() },
  });

  // Send
  const result = await sendReceipt(id, datevProfileId);

  if (result.success) {
    return NextResponse.json({
      message: "Beleg wurde erneut erfolgreich versendet.",
      messageId: result.messageId,
    });
  } else {
    return NextResponse.json(
      { error: result.errorMessage ?? "Erneuter Versand fehlgeschlagen." },
      { status: 500 },
    );
  }
}
