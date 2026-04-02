import { defaultOutlookMetricId } from "../config/outlookMetricRegistry";

export interface OutlookPreferences {
  primaryBankId: string;
  peerBankIds: string[];
  metricId: string;
}

const STORAGE_KEY = "outlookPagePreferences.v1";
const MAX_PEERS = 4;

function getStorage(): Storage | null {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return null;
  }
  return globalThis.localStorage;
}

export function sanitizeOutlookPreferences(
  raw: Partial<OutlookPreferences> | null | undefined
): OutlookPreferences {
  const primaryBankId = typeof raw?.primaryBankId === "string" ? raw.primaryBankId.trim() : "";
  const metricId =
    typeof raw?.metricId === "string" && raw.metricId.trim().length > 0
      ? raw.metricId.trim()
      : defaultOutlookMetricId;

  const peerBankIds = Array.isArray(raw?.peerBankIds)
    ? Array.from(
        new Set(
          raw.peerBankIds
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0 && value !== primaryBankId)
        )
      ).slice(0, MAX_PEERS)
    : [];

  return {
    primaryBankId,
    peerBankIds,
    metricId,
  };
}

export function loadOutlookPreferences(): OutlookPreferences {
  const storage = getStorage();
  if (!storage) {
    return sanitizeOutlookPreferences(null);
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return sanitizeOutlookPreferences(null);
    }
    return sanitizeOutlookPreferences(JSON.parse(rawValue) as Partial<OutlookPreferences>);
  } catch {
    return sanitizeOutlookPreferences(null);
  }
}

export function saveOutlookPreferences(preferences: OutlookPreferences): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeOutlookPreferences(preferences)));
}

export function togglePeerSelection(currentPeerBankIds: string[], peerBankId: string): string[] {
  const normalizedBankId = peerBankId.trim();
  if (!normalizedBankId) {
    return currentPeerBankIds;
  }
  if (currentPeerBankIds.includes(normalizedBankId)) {
    return currentPeerBankIds.filter((value) => value !== normalizedBankId);
  }
  if (currentPeerBankIds.length >= MAX_PEERS) {
    return currentPeerBankIds;
  }
  return [...currentPeerBankIds, normalizedBankId];
}
