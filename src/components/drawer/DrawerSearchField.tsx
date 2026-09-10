import { Search } from 'lucide-react'
import { PANEL_SEARCH_WRAP, PANEL_SEARCH_INPUT } from '@/lib/panelSearchStyles'

interface DrawerSearchFieldProps {
  value: string
  onChange: (value: string) => void
  /** Used as both the input placeholder and its aria-label (same text on every caller). */
  placeholder: string
}

// Client-side search box for a drawer sub-entity list (contacts/departments toolbars):
// icon + bordered input on the shared PANEL_SEARCH_WRAP/INPUT tokens. Extracted from
// ContactsPanel and DepartmentsPanel, whose toolbars rendered this exact markup twice.
export default function DrawerSearchField({ value, onChange, placeholder }: DrawerSearchFieldProps) {
  return (
    <div style={PANEL_SEARCH_WRAP}>
      <Search size={13} color="var(--text-muted)" />
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} aria-label={placeholder} style={PANEL_SEARCH_INPUT} />
    </div>
  )
}
