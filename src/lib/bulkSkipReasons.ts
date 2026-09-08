import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

// BULK-SKIP-REASONS-1: group reasoned skip rows ({id, reason}) into a human
// "N reason, M reason" string; '' when the server sent bare ids or no reason
// (callers then fall back to the bare count).
// HF-CONTRACTMAP-1: the same pattern holds for backoffice coupling (matches).
export function reasonBreakdown(skipped: unknown[] | undefined, t: TFunction): string {
  const reasoned = (skipped ?? []).filter((s): s is { id: Id; reason: string } => {
    if (typeof s !== 'object' || s === null || !('reason' in s)) return false
    const reason = (s as Record<string, unknown>).reason
    return typeof reason === 'string' && reason.length > 0
  })
  if (!reasoned.length) return ''
  const counts: Record<string, number> = {}
  reasoned.forEach(s => { counts[s.reason] = (counts[s.reason] ?? 0) + 1 })
  return Object.entries(counts)
    .map(([reason, count]) => `${count} ${t(`bulk.skipReasons.${reason}`, { defaultValue: reason })}`)
    .join(', ')
}
