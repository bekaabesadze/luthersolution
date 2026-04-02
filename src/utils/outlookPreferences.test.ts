import { beforeEach, describe, expect, it } from "vitest";
import {
  loadOutlookPreferences,
  sanitizeOutlookPreferences,
  saveOutlookPreferences,
  togglePeerSelection,
} from "./outlookPreferences";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

describe("outlookPreferences", () => {
  it("sanitizes duplicate peers and removes the primary bank from peer selection", () => {
    const result = sanitizeOutlookPreferences({
      primaryBankId: "Alpha Bank",
      peerBankIds: [
        "Bravo Bank",
        "Alpha Bank",
        "Bravo Bank",
        "Charlie Bank",
        "Delta Bank",
        "Echo Bank",
        "Foxtrot Bank",
      ],
      metricId: "net_profit",
    });

    expect(result).toEqual({
      primaryBankId: "Alpha Bank",
      peerBankIds: ["Bravo Bank", "Charlie Bank", "Delta Bank", "Echo Bank"],
      metricId: "net_profit",
    });
  });

  it("persists and reloads saved preferences", () => {
    saveOutlookPreferences({
      primaryBankId: "Alpha Bank",
      peerBankIds: ["Bravo Bank", "Charlie Bank"],
      metricId: "loan_to_deposit_ratio",
    });

    expect(loadOutlookPreferences()).toEqual({
      primaryBankId: "Alpha Bank",
      peerBankIds: ["Bravo Bank", "Charlie Bank"],
      metricId: "loan_to_deposit_ratio",
    });
  });

  it("toggles peers while respecting the 4-peer cap", () => {
    const added = togglePeerSelection(["Bravo Bank", "Charlie Bank", "Delta Bank", "Echo Bank"], "Foxtrot Bank");
    const removed = togglePeerSelection(["Bravo Bank", "Charlie Bank"], "Charlie Bank");

    expect(added).toEqual(["Bravo Bank", "Charlie Bank", "Delta Bank", "Echo Bank"]);
    expect(removed).toEqual(["Bravo Bank"]);
  });
});
