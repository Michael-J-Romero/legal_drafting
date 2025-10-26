'use client';

export const LS_HISTORY_KEY = 'legalDraftingHistoryV1';

export function writeHistory(past, present, future) {
  try {
    if (typeof window === 'undefined') return;
    const payload = { past, present, future };
    window.localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(payload));
  } catch (_) {}
}

export function readHistory() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(LS_HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}
