import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SendActions } from "@/components/receipts/send-actions";
import { SendLogTable } from "@/components/receipts/send-log-table";
import { ReviewActions } from "@/components/receipts/review-actions";
import { ReceiptComments } from "@/components/receipts/receipt-comments";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { connection } from "next/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReceiptDetailPage({ params }: Props) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      country: { select: { name: true, code: true } },
      vehicle: { select: { plate: true, description: true } },
      purpose: { select: { name: true, isHospitality: true } },
      category: { select: { name: true } },
      datevProfile: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      hospitality: true,
      files: { where: { type: "ORIGINAL" } },
      sendLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!receipt) notFound();

  if (session.user.role !== "ADMIN" && receipt.userId !== session.user.id) {
    notFound();
  }

  // Load active DATEV profiles for send action
  const datevProfiles = await prisma.datevProfile.findMany({
    where: { active: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const originalFile = receipt.files[0] ?? null;
  const isImage = originalFile?.mimeType.startsWith("image/");
  const fmtDate = (d: Date) => format(d, "dd.MM.yyyy", { locale: de });
  const fmtAmount = (a: unknown) => {
    const n = Number(a);
    return isNaN(n) ? "—" : n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const lastLog = receipt.sendLogs[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/receipts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
      >
        &larr; Zurueck zur Liste
      </Link>

      {/* Warnings */}
      {receipt.purpose.isHospitality && !receipt.hospitality ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">
            Bewirtungsangaben fehlen. Dieser Beleg erfordert Anlass, Gaeste und Ort.
            <Link href={`/receipts/${receipt.id}/edit`} className="ml-1 underline">Jetzt ergaenzen</Link>
          </p>
        </div>
      ) : null}
      {!originalFile ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-accent-foreground">
            Keine Belegdatei vorhanden. Versand und Einreichung sind ohne Datei nicht moeglich.
            <Link href={`/receipts/${receipt.id}/edit`} className="ml-1 underline">Datei nachreichen</Link>
          </p>
        </div>
      ) : null}
      {receipt.currency !== "EUR" && !receipt.exchangeRate ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-accent-foreground">
            Wechselkurs fehlt fuer Fremdwaehrung {receipt.currency}.
            <Link href={`/receipts/${receipt.id}/edit`} className="ml-1 underline">Jetzt ergaenzen</Link>
          </p>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Beleg</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {receipt.supplier ?? "Beleg"} — {fmtDate(receipt.date)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Erfasst von {receipt.user.name} am {fmtDate(receipt.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={receipt.sendStatus} />
          <Link
            href={`/receipts/${receipt.id}/edit`}
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Bearbeiten
          </Link>
          <Link
            href={`/receipts/${receipt.id}/print`}
            target="_blank"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Druckansicht
          </Link>
          <a
            href={`/api/receipts/${receipt.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            PDF
          </a>
        </div>
      </div>

      {/* Review / Workflow */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Pruefung / Freigabe</h2>
        <div className="mt-4">
          <ReviewActions
            receiptId={receipt.id}
            reviewStatus={receipt.reviewStatus}
            isAdmin={session.user.role === "ADMIN"}
            reviewedByName={receipt.reviewedBy?.name}
            reviewedAt={receipt.reviewedAt?.toISOString()}
          />
        </div>
        {receipt.datevProfile ? (
          <p className="mt-3 text-xs text-muted-foreground">DATEV-Profil: {receipt.datevProfile.name}</p>
        ) : null}
      </Card>

      {/* Send Actions */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Versand</h2>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          {receipt.sendStatusUpdatedAt ? (
            <p>Letzter Statuswechsel: {format(receipt.sendStatusUpdatedAt, "dd.MM.yyyy, HH:mm", { locale: de })} Uhr</p>
          ) : null}
          {lastLog && !lastLog.success ? (
            <p className="font-medium text-danger">
              Letzter Fehler: {lastLog.errorMessage ?? "Unbekannter Fehler"}
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <SendActions
            receiptId={receipt.id}
            sendStatus={receipt.sendStatus}
            datevProfiles={datevProfiles}
          />
        </div>
      </Card>

      {/* Original File */}
      {originalFile ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Originalbeleg</h2>
          <div className="mt-4">
            {isImage ? (
              <img
                src={`/api/files/${originalFile.id}`}
                alt="Originalbeleg"
                className="max-h-96 rounded-xl object-contain"
              />
            ) : (
              <iframe
                src={`/api/files/${originalFile.id}`}
                className="h-96 w-full rounded-xl border border-border"
                title="PDF-Vorschau"
              />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {originalFile.filename} — {originalFile.mimeType} — {(originalFile.sizeBytes / 1024).toFixed(0)} KB
            </p>
          </div>
        </Card>
      ) : null}

      {/* Core Data */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Belegdaten</h2>
        <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Belegdatum" value={fmtDate(receipt.date)} />
          <Field label="Betrag" value={`${fmtAmount(receipt.amount)} ${receipt.currency}`} />
          {receipt.currency !== "EUR" ? (
            <>
              <Field label="EUR-Betrag" value={`${fmtAmount(receipt.amountEur)} EUR`} />
              <Field label="Wechselkurs" value={receipt.exchangeRate ? `1 EUR = ${Number(receipt.exchangeRate)} ${receipt.currency}` : "—"} />
              <Field label="Kursdatum" value={receipt.exchangeRateDate ? fmtDate(receipt.exchangeRateDate) : "—"} />
            </>
          ) : null}
          <Field label="Lieferant" value={receipt.supplier ?? "—"} />
          <Field label="Zweck" value={receipt.purpose.name} />
          <Field label="Kategorie" value={receipt.category.name} />
          <Field label="Land" value={receipt.country ? `${receipt.country.name}${receipt.country.code ? ` (${receipt.country.code})` : ""}` : "—"} />
          <Field label="Kfz" value={receipt.vehicle ? receipt.vehicle.plate : "—"} />
          {receipt.remark ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Bemerkung" value={receipt.remark} />
            </div>
          ) : null}
        </div>
      </Card>

      {/* Hospitality */}
      {receipt.hospitality ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Bewirtungsangaben</h2>
          <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Anlass" value={receipt.hospitality.occasion} />
            <Field label="Gaeste" value={receipt.hospitality.guests} />
            <Field label="Ort" value={receipt.hospitality.location} />
          </div>
        </Card>
      ) : null}

      {/* Send Log */}
      {receipt.sendLogs.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Versandhistorie</h2>
          <div className="mt-4">
            <SendLogTable
              logs={receipt.sendLogs.map((l) => ({
                id: l.id,
                sentAt: l.sentAt.toISOString(),
                toAddress: l.toAddress,
                success: l.success,
                errorMessage: l.errorMessage,
                messageId: l.messageId,
              }))}
            />
          </div>
        </Card>
      ) : null}

      {/* Internal Comments */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Interne Kommentare</h2>
        <div className="mt-4">
          <ReceiptComments receiptId={receipt.id} />
        </div>
      </Card>

      {/* OCR Raw Text */}
      {receipt.ocrRawText ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">OCR-Rohtext</h2>
          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 text-xs text-muted-foreground">
            {receipt.ocrRawText}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "bg-muted text-muted-foreground",
    READY: "bg-accent/20 text-accent-foreground",
    SENT: "bg-primary/10 text-primary",
    FAILED: "bg-danger/10 text-danger",
    RETRY: "bg-accent/20 text-accent-foreground",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}
