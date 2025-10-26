'use client';

export const LS_HISTORY_KEY = 'legalDraftingHistoryV2';

export function writeHistory(past, present, future) {
  try {
    if (typeof window === 'undefined') return;
    const payload = {
      version: 2,
      past: Array.isArray(past) ? past : [],
      present: present || null,
      future: Array.isArray(future) ? future : [],
    };
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
    const past = Array.isArray(parsed.past) ? parsed.past : [];
    const future = Array.isArray(parsed.future) ? parsed.future : [];
    const present = parsed.present && typeof parsed.present === 'object' ? parsed.present : null;
    return { past, present, future };
  } catch (_) {
    return null;
  }
}

export function clearHistoryStorage() {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(LS_HISTORY_KEY);
  } catch (_) {}
}
