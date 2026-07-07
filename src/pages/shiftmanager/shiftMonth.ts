/**
 * shiftMonth — month-key formatting for the shift analysis (shared by the matrix
 * table and the Geplande-UZK chart). Kept separate so the table file only exports
 * a component (react-refresh).
 */

// 'YYYY-MM' → localized short label, e.g. 'mei 26' / 'May 26'.
export function monthLabel(key: string, lang: string) {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleDateString(lang, { month: 'short', year: '2-digit' })
}
