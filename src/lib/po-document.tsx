import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ProcurementAlertRow } from "./procurement";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a2e",
  },
  header: {
    marginBottom: 24,
    textAlign: "center",
    borderBottom: "1 solid #e2e8f0",
    paddingBottom: 16,
  },
  canteenName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 4,
  },
  dateLine: {
    fontSize: 9,
    color: "#475569",
    marginBottom: 4,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    width: "auto",
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #e2e8f0",
    minHeight: 24,
    alignItems: "center",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottom: "2 solid #cbd5e1",
    minHeight: 26,
    alignItems: "center",
  },
  headerCell: {
    padding: 4,
    fontWeight: "bold",
    fontSize: 8,
    color: "#475569",
    textTransform: "uppercase",
  },
  cell: {
    padding: 4,
    fontSize: 9,
    color: "#334155",
  },
  colName: { width: "22%" },
  colUnit: { width: "12%" },
  colStock: { width: "14%", textAlign: "right" as const },
  colNeed: { width: "16%", textAlign: "right" as const },
  colDeficit: { width: "16%", textAlign: "right" as const },
  colReorder: { width: "20%", textAlign: "right" as const },
  footer: {
    marginTop: 24,
    borderTop: "1 solid #e2e8f0",
    paddingTop: 16,
  },
  footerTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
  },
  footerText: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
  },
  signatureLine: {
    marginTop: 32,
  },
  signatureLabel: {
    fontSize: 9,
    color: "#475569",
    borderBottom: "1 solid #94a3b8",
    width: "40%",
    paddingBottom: 20,
    marginBottom: 2,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  summaryText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PODocumentProps {
  alerts: ProcurementAlertRow[];
  date: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PODocument({ alerts, date }: PODocumentProps) {
  const formattedDate = new Date(date + "T00:00:00Z").toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const totalReorderQty = alerts.reduce((sum, a) => sum + a.reorderQty, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.canteenName}>
            CaféSmart — Faculty of Technology
          </Text>
          <Text style={styles.subtitle}>
            University of Ruhuna
          </Text>
          <Text style={styles.title}>PURCHASE ORDER</Text>
          <Text style={styles.dateLine}>
            Date: {formattedDate}  |  PO #: PO-{date}
          </Text>
        </View>

        {/* Procurement Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.colName]}>Ingredient</Text>
            <Text style={[styles.headerCell, styles.colUnit]}>Unit</Text>
            <Text style={[styles.headerCell, styles.colStock]}>Stock</Text>
            <Text style={[styles.headerCell, styles.colNeed]}>Need</Text>
            <Text style={[styles.headerCell, styles.colDeficit]}>Deficit</Text>
            <Text style={[styles.headerCell, styles.colReorder]}>Reorder Qty</Text>
          </View>

          {/* Data Rows */}
          {alerts.map((alert) => (
            <View style={styles.tableRow} key={alert.id}>
              <Text style={[styles.cell, styles.colName]}>
                {alert.ingredientName}
              </Text>
              <Text style={[styles.cell, styles.colUnit]}>
                {alert.unit}
              </Text>
              <Text style={[styles.cell, styles.colStock]}>
                {alert.currentStock.toFixed(3)}
              </Text>
              <Text style={[styles.cell, styles.colNeed]}>
                {alert.forecastedNeed.toFixed(3)}
              </Text>
              <Text style={[styles.cell, styles.colDeficit]}>
                {alert.deficit.toFixed(3)}
              </Text>
              <Text style={[styles.cell, styles.colReorder]}>
                {alert.reorderQty.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            Total Reorder Quantity: {totalReorderQty.toFixed(1)}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Reorder Formula</Text>
          <Text style={styles.footerText}>
            Reorder Qty = (Forecasted Need − Current Stock) × 1.10 buffer,
            rounded up to nearest 0.1 unit.
          </Text>

          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>
              Authorized by: _______________________
            </Text>
            <Text style={{ ...styles.footerText, marginTop: 4 }}>
              Date: _______________________
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
