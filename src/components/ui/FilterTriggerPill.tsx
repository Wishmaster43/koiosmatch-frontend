/**
 * FilterTriggerPill — the ONE trigger face for a filter dropdown that filters a
 * SEARCH surface (vacancy-search in the candidate drawer, candidate-search in
 * the vacancy drawer — §3A twins). Solid button trio per PRIMAIR-VLAK-1, count
 * badge inverted so it survives on the fill. Extracted from VacancySearchFilters
 * after Opus review F caught the twins diverging (one had this pill, the other
 * accidentally wore the add-affordance and lost its accessible name).
 *
 * Every filter trigger carries a filter GLYPH by default (Danny 20-08, pasted
 * the bare "Status" pill: "je ziet niet dat het een filterknopje is" — "you
 * can't tell it's a filter button") — a bare label doesn't read as a filter
 * control. A caller with its own leading icon
 * passes it via `icon`; it replaces the default, never stacks.
 */
import type { ComponentType } from 'react'
import { ListFilter } from 'lucide-react'
import CountBadge from './CountBadge'

interface FilterTriggerPillProps {
  label: string
  count: number
  // Leading glyph; defaults to the filter funnel. Pass null to render none
  // (rare — only when the surrounding chrome already carries the filter signal).
  icon?: ComponentType<{ size?: number }> | null
}

// The one solid-fill trigger face for a search-surface filter dropdown, always
// carrying a filter glyph by default so it reads as a filter control at a glance.
export default function FilterTriggerPill({ label, count, icon: Icon = ListFilter }: FilterTriggerPillProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px',
      whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: count > 0 ? 600 : 500, borderRadius: 6,
      cursor: 'pointer', color: 'var(--button-ink)',
      background: 'var(--button-fill)', border: '1px solid var(--button-border)' }}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {label}
      {/* Re-audit r4 finding 3: the shared CountBadge atom — was a local
          copy pairing the badge fill with the WRONG dark ink token (2.52:1). */}
      {count > 0 && <span aria-hidden="true"><CountBadge count={count} /></span>}
    </span>
  )
}
