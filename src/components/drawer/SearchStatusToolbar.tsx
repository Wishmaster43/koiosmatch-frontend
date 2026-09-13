import type { ReactNode } from 'react'
import DrawerSearchField from './DrawerSearchField'
import StatusFilterSelect from './StatusFilterSelect'
import type { LookupOption } from '@/types/common'

interface SearchStatusToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder: string
  // DRY round 11 (MATCHLISTS): the candidate Matches tab needs 120px against
  // its own "+ Match" button; other callers keep DrawerSearchField's default.
  searchMinWidth?: number
  statusValue: string[]
  onToggleStatus: (v: string) => void
  statuses: LookupOption[]
  optionKey?: (s: LookupOption) => string
  // Trailing action (e.g. the "+ Match"/"+ Nieuw" DrawerAddButton) — rendered
  // last on the SAME row (Danny live review, 04-08: "…moet op 1 lijn!!").
  trailing?: ReactNode
}

/**
 * SearchStatusToolbar — the one-line "search + status filter (+ trailing add
 * button)" row shared by every drawer sub-entity list (candidate/customer/
 * vacancy Matches tabs, the customer Applications list, …). Extracted from
 * four byte-identical copies (DRY round, CANDTABS package) — a caller with no
 * `trailing` simply omits it, never a second markup fork.
 */
export default function SearchStatusToolbar({
  search, onSearchChange, searchPlaceholder, searchMinWidth,
  statusValue, onToggleStatus, statuses, optionKey, trailing,
}: SearchStatusToolbarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <DrawerSearchField value={search} onChange={onSearchChange} placeholder={searchPlaceholder} minWidth={searchMinWidth} />
      <StatusFilterSelect value={statusValue} onToggle={onToggleStatus} statuses={statuses} optionKey={optionKey} />
      {trailing}
    </div>
  )
}
