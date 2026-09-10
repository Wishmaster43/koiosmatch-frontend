import { Search } from 'lucide-react'
import { PANEL_SEARCH_WRAP, PANEL_SEARCH_INPUT } from '@/lib/panelSearchStyles'

interface DrawerSearchFieldProps {
  value: string
  onChange: (value: string) => void
  /** Used as both the input placeholder and its aria-label (same text on every caller). */
  placeholder: string
  /** Overrides PANEL_SEARCH_WRAP's default minWidth:0 (DRY round 11, MATCHLISTS: the
   * candidate/customer/vacancy sub-list toolbars need the frame to hold 120px against
   * a status filter + add button, instead of yielding all the way down). */
  minWidth?: number
}

// Client-side search box for a drawer sub-entity list (contacts/departments toolbars,
// and — since DRY round 11 — the candidate/customer/vacancy Matches/Applicants
// toolbars) — icon + bordered input on the shared PANEL_SEARCH_WRAP/INPUT tokens.
// Extracted from ContactsPanel and DepartmentsPanel, whose toolbars rendered this
// exact markup twice; adopted (never duplicated) by the sub-list toolbars that
// shared the same markup with only their minWidth differing.
export default function DrawerSearchField({ value, onChange, placeholder, minWidth }: DrawerSearchFieldProps) {
  const wrapStyle = minWidth === undefined ? PANEL_SEARCH_WRAP : { ...PANEL_SEARCH_WRAP, minWidth }
  return (
    <div style={wrapStyle}>
      <Search size={13} color="var(--text-muted)" />
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} aria-label={placeholder} style={PANEL_SEARCH_INPUT} />
    </div>
  )
}
