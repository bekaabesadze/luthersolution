import { describe, it, expect, beforeEach } from "vitest";
import {
  getDefaultDashboardLayoutState,
  loadDashboardLayoutState,
  saveDashboardLayoutState,
} from "./dashboardLayoutStorage";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

describe("dashboardLayoutStorage", () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MemoryStorage();
  });

  it("returns default layout when storage is empty", () => {
    const state = loadDashboardLayoutState();
    expect(state.version).toBe(1);
    expect(state.grid.length).toBeGreaterThan(0);
    expect(state.slots.length).toBeGreaterThan(0);
  });

  it("round-trips a saved layout", () => {
    const original = getDefaultDashboardLayoutState();
    original.slots[0].widgetId = null;
    saveDashboardLayoutState(original);
    const loaded = loadDashboardLayoutState();
    expect(loaded).toEqual(original);
  });

  it("falls back to default on invalid JSON", () => {
    globalThis.localStorage.setItem("dashboardLayout:v1", "{not-json");
    const loaded = loadDashboardLayoutState();
    expect(loaded).toEqual(getDefaultDashboardLayoutState());
  });

  it("falls back to default on version mismatch", () => {
    globalThis.localStorage.setItem(
      "dashboardLayout:v1",
      JSON.stringify({ version: 999, grid: [], slots: [] })
    );
    const loaded = loadDashboardLayoutState();
    expect(loaded).toEqual(getDefaultDashboardLayoutState());
  });

  it("falls back to default when grid/slot ids mismatch", () => {
    globalThis.localStorage.setItem(
      "dashboardLayout:v1",
      JSON.stringify({
        version: 1,
        grid: [{ i: "a", x: 0, y: 0, w: 2, h: 2 }],
        slots: [{ slotId: "b", widgetId: null }],
      })
    );
    const loaded = loadDashboardLayoutState();
    expect(loaded).toEqual(getDefaultDashboardLayoutState());
  });
});

