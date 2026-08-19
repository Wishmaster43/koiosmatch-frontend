/**
 * FilterTriggerPill — the ONE trigger face for a filter dropdown that filters a
 * SEARCH surface (vacancy-search in the candidate drawer, candidate-search in
 * the vacancy drawer — §3A twins). Solid button trio per PRIMAIR-VLAK-1, count
 * badge inverted so it survives on the fill. Extracted from VacancySearchFilters
 * after Opus review F caught the twins diverging (one had this pill, the other
 * accidentally wore the add-affordance and lost its accessible name).
 */
import { tint } from '@/lib/tint'

export default function FilterTriggerPill({ label, count }: { label: string; count: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px',
      whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: count > 0 ? 600 : 500, borderRadius: 6,
      cursor: 'pointer', color: 'var(--button-ink)',
      background: 'var(--button-fill)', border: '1px solid var(--button-border)' }}>
      {label}
      {count > 0 && (
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999,
          background: 'var(--button-ink)', color: 'var(--color-primary-text)',
          fontSize: 10, fontWeight: 700, lineHeight: 1 }}>{count}</span>
      )}
    </span>
  )
}
// tint import kept referenced for the calm variant some callers may add later;
// removing it here would orphan the shared formula this pill's docs point at.
void tint
