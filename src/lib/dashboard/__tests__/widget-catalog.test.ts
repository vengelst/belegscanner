import { describe, it, expect } from "vitest";
import {
  getDefaultLayout,
  mergeWithCatalog,
  WIDGET_CATALOG,
  getWidgetDefinition,
} from "../widget-catalog";

describe("widget-catalog", () => {
  describe("getDefaultLayout", () => {
    it("returns one config entry per catalog item", () => {
      const layout = getDefaultLayout();
      expect(layout).toHaveLength(WIDGET_CATALOG.length);
    });

    it("all entries are visible by default", () => {
      const layout = getDefaultLayout();
      expect(layout.every((w) => w.visible)).toBe(true);
    });

    it("orders match catalog index", () => {
      const layout = getDefaultLayout();
      layout.forEach((w, i) => {
        expect(w.order).toBe(i);
        expect(w.type).toBe(WIDGET_CATALOG[i].type);
      });
    });
  });

  describe("mergeWithCatalog", () => {
    it("preserves saved visibility and order", () => {
      const saved = [
        { id: "kpi_total_receipts", type: "kpi_total_receipts", visible: false, order: 5, size: "sm" as const },
      ];
      const merged = mergeWithCatalog(saved);
      const first = merged.find((w) => w.type === "kpi_total_receipts");
      expect(first?.visible).toBe(false);
      expect(first?.order).toBe(5);
    });

    it("adds new catalog items that are missing from saved config", () => {
      const saved = [
        { id: "kpi_total_receipts", type: "kpi_total_receipts", visible: true, order: 0, size: "sm" as const },
      ];
      const merged = mergeWithCatalog(saved);
      expect(merged.length).toBe(WIDGET_CATALOG.length);
      const added = merged.filter((w) => w.type !== "kpi_total_receipts");
      expect(added.every((w) => w.visible === false)).toBe(true);
    });

    it("removes saved entries that no longer exist in catalog", () => {
      const saved = [
        { id: "ghost", type: "nonexistent_widget", visible: true, order: 0 },
        { id: "kpi_total_receipts", type: "kpi_total_receipts", visible: true, order: 1, size: "sm" as const },
      ];
      const merged = mergeWithCatalog(saved);
      expect(merged.find((w) => w.type === "nonexistent_widget")).toBeUndefined();
      expect(merged.find((w) => w.type === "kpi_total_receipts")).toBeDefined();
    });
  });

  describe("getWidgetDefinition", () => {
    it("returns definition for known type", () => {
      const def = getWidgetDefinition("problems");
      expect(def).toBeDefined();
      expect(def?.category).toBe("problems");
    });

    it("returns undefined for unknown type", () => {
      expect(getWidgetDefinition("nonexistent")).toBeUndefined();
    });
  });
});
