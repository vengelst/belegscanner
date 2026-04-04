"use client";

// ============================================================
// Types
// ============================================================

type PrintReceipt = {
  id: string;
  date: string;
  supplier: string | null;
  amount: number;
  currency: string;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  amountEur: number;
  sendStatus: string;
  sendStatusUpdatedAt: string | null;
  userName: string;
  purposeName: string;
  categoryName: string;
  countryName: string | null;
  countryCode: string | null;
  vehiclePlate: string | null;
  remark: string | null;
  createdAt: string;
  hospitality: {
    occasion: string;
    guests: string;
    location: string;
  } | null;
  file: {
    id: string;
    mimeType: string;
    filename: string;
  } | null;
};

// ============================================================
// Helpers
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  OPEN: "offen",
  READY: "bereit zum Versand",
  SENT: "gesendet",
  FAILED: "fehlgeschlagen",
  RETRY: "erneut senden",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtAmount(n: number) {
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ============================================================
// Component
// ============================================================

export function ReceiptPrintView({ receipt }: { receipt: PrintReceipt }) {
  const isImage = receipt.file?.mimeType.startsWith("image/");

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; margin: 0; padding: 0; }
          .print-controls { display: none !important; }
          .print-page { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .page-break { page-break-after: always; }
        }
        @media screen {
          .print-page {
            max-width: 210mm;
            margin: 16px auto;
            padding: 20mm 15mm;
            background: white;
            color: #1a1a1a;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
            font-family: Arial, Helvetica, sans-serif;
          }
        }
        .print-page { font-size: 11pt; line-height: 1.5; }
        .print-page * { color: #1a1a1a; }
      `}</style>

      {/* Screen controls (hidden when printing) */}
      <div className="print-controls" style={{ maxWidth: "210mm", margin: "16px auto", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <a
          href={`/receipts/${receipt.id}`}
          style={{ padding: "8px 16px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "8px", textDecoration: "none", color: "#666" }}
        >
          Zurueck
        </a>
        <a
          href={`/api/receipts/${receipt.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "8px 16px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "8px", textDecoration: "none", color: "#666" }}
        >
          PDF herunterladen
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          style={{ padding: "8px 16px", fontSize: "13px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
        >
          Drucken
        </button>
      </div>

      {/* A4 Print page 1 */}
      <div className="print-page page-break" style={{ minHeight: "297mm", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {receipt.file ? (
          <div style={{ width: "100%", height: "100%", textAlign: "center" }}>
            {isImage ? (
              <img
                src={`/api/files/${receipt.file.id}`}
                alt="Originalbeleg"
                style={{ maxWidth: "100%", maxHeight: "250mm", objectFit: "contain" }}
              />
            ) : (
              <div style={{ padding: "24px", color: "#666", fontSize: "10pt" }}>
                <div>
                  Das Original-PDF wird ueber den PDF-Download unveraendert bereitgestellt.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "16px", border: "1px dashed #ccc", borderRadius: "4px", textAlign: "center", color: "#999", fontSize: "10pt" }}>
            Kein Originalbeleg vorhanden.
          </div>
        )}
      </div>

      {/* A4 Print page 2 */}
      <div className="print-page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1a1a1a", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "18pt", fontWeight: 700, letterSpacing: "0.05em" }}>BELEGBOX</div>
            <div style={{ fontSize: "9pt", color: "#666", marginTop: "2px" }}>
              Beleg-Nr.: {receipt.id.slice(0, 12).toUpperCase()}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: "9pt", color: "#666" }}>
            <div>Erstellt: {fmtDateTime(receipt.createdAt)}</div>
            <div>Benutzer: {receipt.userName}</div>
          </div>
        </div>

        {/* Core data table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt", marginBottom: "16px" }}>
          <tbody>
            <DataRow label="Belegdatum" value={fmtDate(receipt.date)} />
            <DataRow label="Lieferant" value={receipt.supplier ?? "—"} />
            <DataRow label="Betrag" value={`${fmtAmount(receipt.amount)} ${receipt.currency}`} />
            {receipt.currency !== "EUR" ? (
              <>
                <DataRow label="EUR-Betrag" value={`${fmtAmount(receipt.amountEur)} EUR`} />
                <DataRow label="Wechselkurs" value={receipt.exchangeRate ? `1 EUR = ${receipt.exchangeRate} ${receipt.currency}` : "—"} />
                <DataRow label="Kursdatum" value={receipt.exchangeRateDate ? fmtDate(receipt.exchangeRateDate) : "—"} />
              </>
            ) : null}
            <DataRow label="Zweck" value={receipt.purposeName} />
            <DataRow label="Kategorie" value={receipt.categoryName} />
            <DataRow label="Land" value={receipt.countryName ? `${receipt.countryName}${receipt.countryCode ? ` (${receipt.countryCode})` : ""}` : "—"} />
            <DataRow label="Kfz" value={receipt.vehiclePlate ?? "—"} />
            <DataRow label="Benutzer" value={receipt.userName} />
            {receipt.remark ? (
              <DataRow label="Bemerkung" value={receipt.remark} />
            ) : null}
          </tbody>
        </table>

        {/* Send status */}
        <div style={{ borderTop: "1px solid #ddd", paddingTop: "12px", marginBottom: "16px" }}>
          <SectionTitle>Versand</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
            <tbody>
              <DataRow label="Status" value={STATUS_LABELS[receipt.sendStatus] ?? receipt.sendStatus} />
              {receipt.sendStatusUpdatedAt ? (
                <DataRow label="Letzter Statuswechsel" value={fmtDateTime(receipt.sendStatusUpdatedAt)} />
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Currency block */}
        {receipt.currency !== "EUR" ? (
          <div style={{ borderTop: "1px solid #ddd", paddingTop: "12px", marginBottom: "16px" }}>
            <SectionTitle>Waehrung</SectionTitle>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
              <tbody>
                <DataRow label="Originalbetrag" value={`${fmtAmount(receipt.amount)} ${receipt.currency}`} />
                <DataRow label="Wechselkurs" value={receipt.exchangeRate ? `1 EUR = ${receipt.exchangeRate} ${receipt.currency}` : "—"} />
                <DataRow label="Kursdatum" value={receipt.exchangeRateDate ? fmtDate(receipt.exchangeRateDate) : "—"} />
                <DataRow label="EUR-Betrag" value={`${fmtAmount(receipt.amountEur)} EUR`} />
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Hospitality block */}
        {receipt.hospitality ? (
          <div style={{ borderTop: "1px solid #ddd", paddingTop: "12px", marginBottom: "16px" }}>
            <SectionTitle>Bewirtung</SectionTitle>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
              <tbody>
                <DataRow label="Anlass" value={receipt.hospitality.occasion} />
                <DataRow label="Gaeste" value={receipt.hospitality.guests} />
                <DataRow label="Ort" value={receipt.hospitality.location} />
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "8px", marginTop: "24px", display: "flex", justifyContent: "space-between", fontSize: "8pt", color: "#999" }}>
          <span>Erstellt: {fmtDateTime(receipt.createdAt)}</span>
          <span>BelegBox v1.0</span>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10pt", fontWeight: 700, marginBottom: "6px", letterSpacing: "0.03em" }}>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "3px 12px 3px 0", verticalAlign: "top", whiteSpace: "nowrap", color: "#666", width: "140px" }}>
        {label}:
      </td>
      <td style={{ padding: "3px 0", verticalAlign: "top" }}>
        {value}
      </td>
    </tr>
  );
}
