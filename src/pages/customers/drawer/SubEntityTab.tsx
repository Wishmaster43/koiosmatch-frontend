/**
 * SubEntityTab — shared list/detail shell for a customer's nested sub-entities
 * (locations / departments / contacts). Renders a searchable DataTable with an
 * add button; clicking a row drills into a detail view (with a back button). The
 * columns + detail renderer are passed in per entity, so this stays DRY.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
// House "+ action" trigger (Danny 27-07 consistency sweep) — replaces the
// hand-rolled solid-fill addBtn below on every SubEntityTab consumer
// (Locaties/Afdelingen/Contactpersonen).
import DrawerAddButton from '@/components/drawer/DrawerAddButton'

const searchWrap: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
}
const searchInput: CSSProperties = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }
const backBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12, padding: '5px 0', fontSize: 12, fontWeight: 500,
  background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer',
}

interface SubEntityTabProps<Item> {
  items?: Item[]
  columns: Column<Item>[]
  addLabel?: ReactNode
  emptyText?: string
  searchPlaceholder?: string
  backLabel?: ReactNode
  searchKeys?: string[]
  onAdd?: () => void
  /**
   * Open this row's detail from OUTSIDE the tab (Danny 28-07: clicking a contact in a
   * location's list must land on that contact's own drill-down, the same screen the
   * Contactpersonen tab shows). Each new value opens it once; the user can still
   * navigate away afterwards, so this seeds the selection rather than pinning it.
   */
  openId?: string | number | null
  // `close` lets the detail view return to the list itself (e.g. after a delete).
  renderDetail: (item: Item, close: () => void) => ReactNode
  getRowId?: (item: Item) => string | number | undefined
}

export default function SubEntityTab<Item extends object>({
  items = [], columns, addLabel, emptyText, searchPlaceholder, backLabel,
  searchKeys = ['name'], onAdd, openId, renderDetail,
  getRowId = (it: Item) => (it as { id?: string | number }).id,
}: SubEntityTabProps<Item>) {
  const [search, setSearch]         = useState('')
  const [selectedId, setSelectedId] = useState<string | number | undefined>(openId ?? undefined)
  // Adopt each NEW openId during render (no effect, so the detail is on screen in the
  // same paint as the tab switch). Tracking the last value it acted on is what lets the
  // user press Terug afterwards without the same id immediately reopening.
  const [lastOpenId, setLastOpenId] = useState<string | number | null | undefined>(openId)
  if (openId !== lastOpenId) { setLastOpenId(openId); if (openId != null) setSelectedId(openId) }
  // Track by id, not object reference, so the detail pane stays live when the
  // parent's list updates (in-place edit) instead of freezing the clicked snapshot.
  const selected = selectedId !== undefined ? items.find(it => getRowId(it) === selectedId) ?? null : null

  // Detail view — show the picked sub-entity with a back button.
  if (selected) {
    return (
      <div>
        <button onClick={() => setSelectedId(undefined)} style={backBtn}><ArrowLeft size={13} /> {backLabel}</button>
        {renderDetail(selected, () => setSelectedId(undefined))}
      </div>
    )
  }

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
        {onAdd && <DrawerAddButton onClick={onAdd} label={addLabel} />}
      </div>
      <DataTable columns={columns} rows={rows} onRowClick={it => setSelectedId(getRowId(it))} emptyText={emptyText} />
    </div>
  )
}
