/**
 * Generates a clean A4 PDF for DATEV submission of image-based receipts (photos/scans).
 *
 * Layout: One page with the receipt image prominently displayed and relevant
 * business data printed on the same page. No internal IDs, no app branding,
 * no send status — only information useful for the accounting office.
 */

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

export type DatevPdfData = {
  date: string;
  supplier: string | null;
  amount: string;
  currency: string;
  amountEur: string;
  exchangeRate: string | null;
  exchangeRateDate: string | null;
  purposeName: string;
  countryName: string | null;
  vehiclePlate: string | null;
  remark: string | null;
  hospitality: {
    occasion: string;
    guests: string;
    location: string;
  } | null;
  imageBase64: string;
  imageMimeType: string;
};

// ============================================================
// Styles
// ============================================================

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 40,
    color: "#1a1a1a",
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  image: {
    maxHeight: 400,
    maxWidth: 500,
    objectFit: "contain",
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    marginTop: 4,
    marginBottom: 8,
  },
  dataGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dataCell: {
    width: "50%",
    marginBottom: 4,
  },
  label: {
    fontSize: 7,
    color: "#888",
    marginBottom: 1,
  },
  value: {
    fontSize: 9,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 4,
  },
});

// ============================================================
// PDF Document
// ============================================================

function buildDatevDocument(data: DatevPdfData) {
  const cells: Array<{ label: string; value: string }> = [
    { label: "Datum", value: data.date },
    { label: "Betrag", value: `${data.amount} ${data.currency}` },
  ];

  if (data.currency !== "EUR") {
    cells.push({ label: "EUR-Betrag", value: `${data.amountEur} EUR` });
    if (data.exchangeRate) cells.push({ label: "Wechselkurs", value: `1 EUR = ${data.exchangeRate} ${data.currency}` });
    if (data.exchangeRateDate) cells.push({ label: "Kursdatum", value: data.exchangeRateDate });
  }

  if (data.supplier) cells.push({ label: "Lieferant", value: data.supplier });
  cells.push({ label: "Zweck", value: data.purposeName });
  if (data.countryName) cells.push({ label: "Land", value: data.countryName });
  if (data.vehiclePlate) cells.push({ label: "Kfz", value: data.vehiclePlate });
  if (data.remark) cells.push({ label: "Bemerkung", value: data.remark });

  return React.createElement(
    Document,
    { title: `Beleg ${data.date}` },
    React.createElement(
      Page,
      { size: "A4", style: s.page },
      // Receipt image
      React.createElement(
        View,
        { style: s.imageContainer },
        React.createElement(Image, {
          style: s.image,
          src: `data:${data.imageMimeType};base64,${data.imageBase64}`,
        }),
      ),
      // Separator
      React.createElement(View, { style: s.separator }),
      // Data grid
      React.createElement(
        View,
        { style: s.dataGrid },
        ...cells.map((cell) =>
          React.createElement(
            View,
            { style: s.dataCell, key: cell.label },
            React.createElement(Text, { style: s.label }, cell.label),
            React.createElement(Text, { style: s.value }, cell.value),
          ),
        ),
      ),
      // Hospitality block
      ...(data.hospitality
        ? [
            React.createElement(Text, { style: s.sectionTitle, key: "hospTitle" }, "Bewirtung"),
            React.createElement(
              View,
              { style: s.dataGrid, key: "hospData" },
              React.createElement(
                View,
                { style: s.dataCell },
                React.createElement(Text, { style: s.label }, "Anlass"),
                React.createElement(Text, { style: s.value }, data.hospitality.occasion),
              ),
              React.createElement(
                View,
                { style: s.dataCell },
                React.createElement(Text, { style: s.label }, "Ort"),
                React.createElement(Text, { style: s.value }, data.hospitality.location),
              ),
              React.createElement(
                View,
                { style: { ...s.dataCell, width: "100%" } },
                React.createElement(Text, { style: s.label }, "Gaeste / Teilnehmer"),
                React.createElement(Text, { style: s.value }, data.hospitality.guests),
              ),
            ),
          ]
        : []),
    ),
  );
}

// ============================================================
// Public API
// ============================================================

export async function generateDatevPdf(data: DatevPdfData): Promise<Buffer> {
  const element = buildDatevDocument(data);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}
