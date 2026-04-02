import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";

const reviewActionSchema = z.object({
  action: z.enum(["submit", "approve", "defer", "complete", "reopen", "revert"]),
});

// Allowed transitions per role
// USER:  DRAFT -> IN_REVIEW (submit)
//        DEFERRED -> DRAFT (reopen) — eigenen zurueckgestellten Beleg nachbearbeiten
// ADMIN: IN_REVIEW -> APPROVED (approve), DRAFT -> APPROVED (approve, skip review)
//        IN_REVIEW -> DEFERRED (defer)
//        APPROVED -> COMPLETED (complete)
//        COMPLETED -> DRAFT (revert) — nur Admin darf abgeschlossene wieder oeffnen

const TRANSITIONS: Record<string, { from: string[]; to: string; adminOnly: boolean }> = {
  submit:   { from: ["DRAFT"],              to: "IN_REVIEW", adminOnly: false },
  approve:  { from: ["IN_REVIEW", "DRAFT"], to: "APPROVED",  adminOnly: true },
  defer:    { from: ["IN_REVIEW"],          to: "DEFERRED",  adminOnly: true },
  complete: { from: ["APPROVED"],           to: "COMPLETED", adminOnly: true },
  reopen:   { from: ["DEFERRED"],           to: "DRAFT",     adminOnly: false },
  revert:   { from: ["COMPLETED"],          to: "DRAFT",     adminOnly: true },
};

// Actions that record the reviewer
const REVIEWER_ACTIONS = new Set(["approve", "defer", "complete"]);
// Actions that clear the reviewer (back to draft)
const CLEAR_REVIEWER_ACTIONS = new Set(["reopen", "revert"]);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = reviewActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Aktion.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: {
      userId: true,
      reviewStatus: true,
      files: { where: { type: "ORIGINAL" }, select: { id: true }, take: 1 },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });
  }

  if (session.role !== "ADMIN" && receipt.userId !== session.userId) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const action = parsed.data.action;
  const transition = TRANSITIONS[action];

  if (transition.adminOnly && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Diese Aktion erfordert Admin-Berechtigung." }, { status: 403 });
  }

  // File required for submit and approve
  if (["submit", "approve"].includes(action) && receipt.files.length === 0) {
    return NextResponse.json(
      { error: "Beleg kann nicht eingereicht/freigegeben werden: keine Belegdatei vorhanden." },
      { status: 400 },
    );
  }

  if (!transition.from.includes(receipt.reviewStatus)) {
    return NextResponse.json(
      { error: `Aktion "${action}" ist im Status "${receipt.reviewStatus}" nicht moeglich.` },
      { status: 400 },
    );
  }

  // Build update payload
  const data: Record<string, unknown> = {
    reviewStatus: transition.to,
  };

  if (REVIEWER_ACTIONS.has(action)) {
    data.reviewedById = session.userId;
    data.reviewedAt = new Date();
  } else if (CLEAR_REVIEWER_ACTIONS.has(action)) {
    data.reviewedById = null;
    data.reviewedAt = null;
  }

  const updated = await prisma.receipt.update({
    where: { id },
    data,
    select: { id: true, reviewStatus: true, reviewedAt: true },
  });

  return NextResponse.json(updated);
}
