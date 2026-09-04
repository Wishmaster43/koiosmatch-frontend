/**
 * NotesToolbar — the notes tab's search box + type/channel filter menu + add
 * button row. Extracted out of NotesTab (§3 split, K-SIZE-SPLIT-A) as a dumb
 * presentational piece; all state/handlers stay owned by the container.
 */
import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'

interface NotesToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filterRows: DrawerFilterConfig[]
  filterLabel: string
  filterTitle: string
  filterClearAllLabel: string
  composerOpen: boolean
  onAddNote: () => void
  newNoteLabel?: ReactNode
}

// No section title (Danny 05-08 "zelfde bij notities" — the tab already names
// the section): the toolbar starts with the search bar on the LEFT, growing,
// at the drill-down's standard footprint (6/10, radius 8, fontSize 12).
export default function NotesToolbar({
  search, onSearchChange, searchPlaceholder, filterRows, filterLabel, filterTitle, filterClearAllLabel,
  composerOpen, onAddNote, newNoteLabel,
}: NotesToolbarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none', flex: 1, minWidth: 0 }} />
      </div>
      {/* NOTES-DOC-FILTER-MENU-1 (Danny 08-08): type + channel now live BEHIND
          this one compact Filter button instead of two inline dropdowns — the
          dropdowns themselves are unchanged (still the house searchable
          SelectMenu), only where they live changed. Self-hides when the host
          offers neither vocabulary (DrawerFilterMenu renders null on empty). */}
      <DrawerFilterMenu filters={filterRows} label={filterLabel} title={filterTitle} clearAllLabel={filterClearAllLabel} />
      {/* NOTITIE-POPOUT-EDIT-1 (Danny 10-08): the toolbar's own pop-out button is
          GONE — it opened the thread but never an editor, which is exactly what
          Danny reported twice. The affordance now lives per NOTE, beside that
          note's pencil and bin (see the note rows below). */}
      {/* Shared reference-style add button (Danny 20-07: notitie-knop had geen
          achtergrondkleur) — one look on every entity's notes tab. Short text
          (DRAWER-ADD-SHORT-1, Danny 05-08): this always renders inside a
          drawer sub-tab, never a full page. Opens the POPUP composer now
          (POPUP-SLEEP-1) instead of an inline block. */}
      {!composerOpen && <DrawerAddButton onClick={onAddNote} label={newNoteLabel} short />}
    </div>
  )
}
