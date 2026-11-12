import type { TFunction } from 'i18next'

// BULK-SKIP-REASONS-1: group reasoned skip rows ({id, reason}) into a human
// "N reason, M reason" string; '' when the server sent bare ids or no reason
// (callers then fall back to the bare count).
// HF-CONTRACTMAP-1: the same pattern holds for backoffice coupling (matches).
export function reasonBreakdown(skipped: unknown[] | undefined, t: TFunction): string {
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
  // The specific `reason_code` (HF-CONTRACT-1) wins over a `code`, which wins over the coarse
  // `reason`; a server that sends a separate `code` puts its human sentence in `reason`
  // (applications bulk), and that sentence is the honest fallback when no key exists.
  const entryOf = (s: unknown): { key: string; text: string | null } | null => {
    if (typeof s !== 'object' || s === null) return null
    const r = s as Record<string, unknown>
    // A bare `code` without a `reason` is not a skip reason (unchanged contract): the code
    // only names the group when the server also sent its reason text.
    const reason = str(r.reason)
    const key = str(r.reason_code) ?? (reason ? (str(r.code) ?? reason) : null)
    if (!key) return null
    const text = str(r.code) && reason && reason !== r.code ? reason : null
    return { key, text }
  }
  const entries = (skipped ?? []).map(entryOf).filter((e): e is { key: string; text: string | null } => e !== null)
  if (!entries.length) return ''
  const counts: Record<string, number> = {}
  const texts: Record<string, string | null> = {}
  entries.forEach(({ key, text }) => { counts[key] = (counts[key] ?? 0) + 1; if (!(key in texts)) texts[key] = text })
  return Object.entries(counts)
    .map(([key, count]) => {
      const i18nKey = `bulk.skipReasons.${key}`
      const label = t(i18nKey)
      // i18next echoes the key when it is missing; then the server's own sentence is shown, never a raw key.
      return `${count} ${label === i18nKey && texts[key] ? texts[key] : label}`
    })
    .join(', ')
}
