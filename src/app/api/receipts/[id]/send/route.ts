import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { validateForSend, sendReceipt } from "@/lib/mail";
import { canUserSendReceipt } from "@/lib/receipts/send-permission";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt || receipt.deletedAt) {
    return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });
  }

  if (session.role !== "ADMIN" && receipt.userId !== session.userId) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  // Only allow send from OPEN or READY
  if (!["OPEN", "READY"].includes(receipt.sendStatus)) {
    return NextResponse.json(
      { error: `Versand nicht moeglich im Status "${receipt.sendStatus}". Nutzen Sie "Erneut senden" bei fehlgeschlagenen oder bereits gesendeten Belegen.` },
      { status: 400 },
    );
  }

  // Server-seitig Flag aus DB laden (nicht nur Session/JWT vertrauen)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { canSendWithoutApproval: true, role: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const role = dbUser.role === "ADMIN" ? "ADMIN" : "USER";
  if (
    !canUserSendReceipt({
      role,
      canSendWithoutApproval: dbUser.canSendWithoutApproval,
      reviewStatus: receipt.reviewStatus,
    })
  ) {
    return NextResponse.json(
      { error: "Beleg muss freigegeben sein (Status: APPROVED), bevor er gesendet werden kann." },
      { status: 400 },
    );
  }

  // Parse optional datevProfileId from body
  let datevProfileId: string | undefined;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.datevProfileId) datevProfileId = String(body.datevProfileId);
  } catch {
    // No body is fine — use default profile
  }

  // Validate
  const validationErrors = await validateForSend(id);
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: "Versandvoraussetzungen nicht erfuellt.", details: validationErrors },
      { status: 400 },
    );
  }

  // Transition to READY before sending
  await prisma.receipt.update({
    where: { id },
    data: { sendStatus: "READY", sendStatusUpdatedAt: new Date() },
  });

  // Send
  const result = await sendReceipt(id, datevProfileId);

  if (result.success) {
    return NextResponse.json({
      message: "Beleg wurde erfolgreich versendet.",
      messageId: result.messageId,
    });
  } else {
    return NextResponse.json(
      { error: result.errorMessage ?? "Versand fehlgeschlagen." },
      { status: 500 },
    );
  }
}
