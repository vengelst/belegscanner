import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ============================================================
// Types
// ============================================================

export type PdfReceiptData = {
  id: string;
  date: string;
  supplier: string | null;
  amount: string;
  currency: string;
  exchangeRate: string | null;
  exchangeRateDate: string | null;
  amountEur: string;
  sendStatus: string;
  sendStatusLabel: string;
  sendStatusUpdatedAt: string | null;
  userName: string;
  purposeName: string;
  categoryName: string;
  countryName: string | null;
  vehiclePlate: string | null;
  remark: string | null;
  createdAt: string;
  hospitality: {
    occasion: string;
    guests: string;
    location: string;
  } | null;
  imageBase64: string | null;
  imageMimeType: string | null;
  pdfOriginalNote: string | null;
};

// ============================================================
// Styles
// ============================================================

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 45,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
  },
  headerRight: {
    textAlign: "right",
    fontSize: 8,
    color: "#666",
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  image: {
    maxHeight: 280,
    objectFit: "contain",
  },
  noImage: {
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 4,
    textAlign: "center",
    color: "#999",
    fontSize: 9,
    marginBottom: 16,
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  sectionBlock: {
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 10,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 120,
    color: "#666",
    fontSize: 9,
  },
  value: {
    flex: 1,
    fontSize: 9,
  },
  footer: {
    borderTopWidth: 2,
    borderTopColor: "#1a1a1a",
    paddingTop: 6,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
  },
});

// ============================================================
// PDF Document
// ============================================================

function buildReceiptDocument(data: PdfReceiptData) {
  return React.createElement(
    Document,
    { title: `Beleg ${data.id.slice(0, 12)}`, author: "BelegBox" },
    React.createElement(
      Page,
      { size: "A4", style: s.page },
      // Header
      React.createElement(
        View,
        { style: s.header },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: s.headerTitle }, "BELEGBOX"),
          React.createElement(Text, { style: s.headerSub }, `Beleg-Nr.: ${data.id.slice(0, 12).toUpperCase()}`),
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: s.headerRight }, `Erstellt: ${data.createdAt}`),
          React.createElement(Text, { style: s.headerRight }, `Benutzer: ${data.userName}`),
        ),
      ),
      // Image
      data.imageBase64
        ? React.createElement(
            View,
            { style: s.imageContainer },
            React.createElement(Image, {
              style: s.image,
              src: `data:${data.imageMimeType};base64,${data.imageBase64}`,
            }),
          )
        : data.pdfOriginalNote
          ? React.createElement(
              View,
              { style: s.noImage },
              React.createElement(Text, null, `PDF-Original: ${data.pdfOriginalNote}`),
            )
          : React.createElement(
              View,
              { style: s.noImage },
              React.createElement(Text, null, "Kein Originalbeleg vorhanden."),
            ),
      // Separator
      React.createElement(View, { style: s.separator }),
      // Core data
      row("Belegdatum", data.date),
      row("Lieferant", data.supplier ?? "\u2014"),
      row("Betrag", `${data.amount} ${data.currency}`),
      ...(data.currency !== "EUR"
        ? [
            row("EUR-Betrag", `${data.amountEur} EUR`),
            row("Wechselkurs", data.exchangeRate ? `1 EUR = ${data.exchangeRate} ${data.currency}` : "\u2014"),
            row("Kursdatum", data.exchangeRateDate ?? "\u2014"),
          ]
        : []),
      row("Zweck", data.purposeName),
      row("Kategorie", data.categoryName),
      row("Land", data.countryName ?? "\u2014"),
      row("Kfz", data.vehiclePlate ?? "\u2014"),
      row("Benutzer", data.userName),
      ...(data.remark ? [row("Bemerkung", data.remark)] : []),
      // Send status block
      React.createElement(
        View,
        { style: s.sectionBlock },
        React.createElement(Text, { style: s.sectionTitle }, "Versand"),
        row("Status", data.sendStatusLabel),
        ...(data.sendStatusUpdatedAt ? [row("Statuswechsel", data.sendStatusUpdatedAt)] : []),
      ),
      // Currency block
      ...(data.currency !== "EUR"
        ? [
            React.createElement(
              View,
              { style: s.sectionBlock, key: "curr" },
              React.createElement(Text, { style: s.sectionTitle }, "Waehrung"),
              row("Originalbetrag", `${data.amount} ${data.currency}`),
              row("Wechselkurs", data.exchangeRate ? `1 EUR = ${data.exchangeRate} ${data.currency}` : "\u2014"),
              row("Kursdatum", data.exchangeRateDate ?? "\u2014"),
              row("EUR-Betrag", `${data.amountEur} EUR`),
            ),
          ]
        : []),
      // Hospitality block
      ...(data.hospitality
        ? [
            React.createElement(
              View,
              { style: s.sectionBlock, key: "hosp" },
              React.createElement(Text, { style: s.sectionTitle }, "Bewirtung"),
              row("Anlass", data.hospitality.occasion),
              row("Gaeste", data.hospitality.guests),
              row("Ort", data.hospitality.location),
            ),
          ]
        : []),
      // Footer
      React.createElement(
        View,
        { style: s.footer },
        React.createElement(Text, null, `Erstellt: ${data.createdAt}`),
        React.createElement(Text, null, "BelegBox v1.0"),
      ),
    ),
  );
}

function row(label: string, value: string) {
  return React.createElement(
    View,
    { style: s.row, key: label },
    React.createElement(Text, { style: s.label }, `${label}:`),
    React.createElement(Text, { style: s.value }, value),
  );
}

// ============================================================
// Public API
// ============================================================

export async function generateReceiptPdf(data: PdfReceiptData): Promise<Buffer> {
  const element = buildReceiptDocument(data);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}
