// ActiveFilterChip — GEOSEARCH-1 (Danny 22-08): the ONE removable soft-chip both
// search twins use for their active-filter row (candidates/drawer/VacancySearchTab's
// secondary filters, vacancies/drawer/CandidateSearchTab's selected values) —
// extracted from VacancySearchFilters' own SecondaryFilterChip so the vacancy side
// gets the identical look instead of a second hand-rolled copy. Always the ACTIVE
// tint (§4): a chip only ever renders while its filter is genuinely selected.
import type { CSSProperties } from 'react'
import { X } from 'lucide-react'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

const chipStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 6px 4px 9px',
  fontSize: 11.5, fontWeight: 600, borderRadius: 999,
  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tintBg/tintBorder ARE the canonical §4 tint helpers; the primary token here is only their argument, not a hand-painted fill
  background: tintBg('var(--color-primary)', true), border: tintBorder('var(--color-primary)', true),
  color: chipInk('var(--color-primary)'),
}
const removeStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15,
  background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0,
}

interface ActiveFilterChipProps {
  label: string
  ariaLabel: string
  onRemove: () => void
}

// The removable filter chip itself: always the active tint, since it only ever renders while its filter is selected.
export default function ActiveFilterChip({ label, ariaLabel, onRemove }: ActiveFilterChipProps) {
  return (
    <span style={chipStyle}>
      {label}
      {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- a 15px remove glyph nested inside an 11.5px chip; smaller than Button's own minimum (28px) footprint, mirrors DrawerFilterMenu's own reasoned trigger exception */}
      <button type="button" onClick={onRemove} aria-label={ariaLabel} style={removeStyle}>
        <X size={11} />
      </button>
    </span>
  )
}
