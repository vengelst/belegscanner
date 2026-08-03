import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { getDefaultLayout, mergeWithCatalog, WIDGET_CATALOG } from "@/lib/dashboard/widget-catalog";
import type { WidgetConfig } from "@/lib/dashboard/widget-catalog";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const config = await prisma.dashboardConfig.findUnique({
    where: { id: "default" },
  });

  let widgets: WidgetConfig[];
  if (!config) {
    widgets = getDefaultLayout();
  } else {
    widgets = mergeWithCatalog(config.widgets as WidgetConfig[]);
  }

  return NextResponse.json({ widgets });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const widgets = body.widgets;

  if (!Array.isArray(widgets)) {
    return NextResponse.json(
      { error: "widgets muss ein Array sein." },
      { status: 400 },
    );
  }

  const validTypes = new Set(WIDGET_CATALOG.map((w) => w.type));
  for (const w of widgets) {
    if (!w.type || !validTypes.has(w.type)) {
      return NextResponse.json(
        { error: `Unbekannter Widget-Typ: ${w.type}` },
        { status: 400 },
      );
    }
    if (typeof w.visible !== "boolean") {
      return NextResponse.json(
        { error: `visible muss boolean sein fuer Widget ${w.type}` },
        { status: 400 },
      );
    }
    if (typeof w.order !== "number") {
      return NextResponse.json(
        { error: `order muss eine Zahl sein fuer Widget ${w.type}` },
        { status: 400 },
      );
    }
    if (w.size && !["sm", "md", "lg"].includes(w.size)) {
      return NextResponse.json(
        { error: `Ungueltige Groesse: ${w.size}` },
        { status: 400 },
      );
    }
  }

  const saved = await prisma.dashboardConfig.upsert({
    where: { id: "default" },
    update: { widgets },
    create: { id: "default", widgets },
  });

  return NextResponse.json({ widgets: saved.widgets });
}
