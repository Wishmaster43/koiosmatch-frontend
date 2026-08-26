/**
 * SubEntityTab — shared list/detail shell for a customer's nested sub-entities
 * (locations / departments / contacts). Renders a searchable DataTable with an
 * add button; clicking a row drills into a detail view (with a back button). The
 * columns + detail renderer are passed in per entity, so this stays DRY.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Search } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
// House "+ action" trigger (Danny 27-07 consistency sweep) — replaces the
// hand-rolled solid-fill addBtn below on every SubEntityTab consumer
// (Locaties/Afdelingen/Contactpersonen).
import DrawerAddButton from '@/components/drawer/DrawerAddButton'

const searchWrap: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
}
const searchInput: CSSProperties = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }

interface SubEntityTabProps<Item> {
  items?: Item[]
  columns: Column<Item>[]
  addLabel?: ReactNode
  emptyText?: string
  searchPlaceholder?: string
  searchKeys?: string[]
  onAdd?: () => void
  /** Rendered between the search box and the add trigger (the status filter). */
  filter?: ReactNode
  // `close` lets the detail view return to the list itself (e.g. after a delete).
  renderDetail: (item: Item, close: () => void) => ReactNode
  getRowId?: (item: Item) => string | number | undefined
}

// Shared list/detail shell for a customer's nested sub-entities; a row click drills into the caller-supplied detail renderer, with its own back-to-list close (see file header).
export default function SubEntityTab<Item extends object>({
  items = [], columns, addLabel, emptyText, searchPlaceholder,
  searchKeys = ['name'], onAdd, filter, renderDetail,
  getRowId = (it: Item) => (it as { id?: string | number }).id,
}: SubEntityTabProps<Item>) {
  const [search, setSearch]         = useState('')
  const [selectedId, setSelectedId] = useState<string | number | undefined>(undefined)
  // Track by id, not object reference, so the detail pane stays live when the
  // parent's list updates (in-place edit) instead of freezing the clicked snapshot.
  const selected = selectedId !== undefined ? items.find(it => getRowId(it) === selectedId) ?? null : null

  // Detail view — the detail owns its own way back: it renders the shared
  // DrillBreadcrumb with the `close` handle below as its first crumb. This shell no
  // longer draws a back button of its own, because a nested drill-down (a contact
  // inside a location) then produced two stacked buttons both labelled "Terug".
  if (selected) return <>{renderDetail(selected, () => setSelectedId(undefined))}</>

  // List view — client-side search over the chosen keys.
  const q = search.trim().toLowerCase()
  const rows = q ? items.filter(it => searchKeys.some(k => String((it as Record<string, unknown>)[k] ?? '').toLowerCase().includes(q))) : items

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={searchWrap}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} style={searchInput} />
        </div>
        {filter}
        {onAdd && <DrawerAddButton onClick={onAdd} label={addLabel} />}
      </div>
      <DataTable columns={columns} rows={rows} onRowClick={it => setSelectedId(getRowId(it))} emptyText={emptyText} />
    </div>
  )
}
