'use client';

export function formatDisplayDate(dateStr) {
  try {
    if (!dateStr) return '__________';
    // Expecting YYYY-MM-DD from input[type="date"]
    const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    const fmt = date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'UTC',
    });
    return fmt;
  } catch (_) {
    return dateStr;
  }
}
