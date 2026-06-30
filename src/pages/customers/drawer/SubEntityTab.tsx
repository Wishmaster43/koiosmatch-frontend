/**
 * SubEntityTab — shared list/detail shell for a customer's nested sub-entities
 * (locations / departments / contacts). Renders a searchable DataTable with an
 * add button; clicking a row drills into a detail view (with a back button). The
 * columns + detail renderer are passed in per entity, so this stays DRY.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Plus, ArrowLeft, Search } from 'lucide-react'
import DataTable from '../../../components/ui/DataTable'
import type { Column } from '../../../components/ui/DataTable'

const searchWrap: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
}
const searchInput: CSSProperties = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }
const addBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 500,
  background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
}
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
  renderDetail: (item: Item) => ReactNode
}

export default function SubEntityTab<Item extends object>({
  items = [], columns, addLabel, emptyText, searchPlaceholder, backLabel,
  searchKeys = ['name'], onAdd, renderDetail,
}: SubEntityTabProps<Item>) {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Item | null>(null)

  // Detail view — show the picked sub-entity with a back button.
  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} style={backBtn}><ArrowLeft size={13} /> {backLabel}</button>
        {renderDetail(selected)}
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
        {onAdd && <button onClick={onAdd} style={addBtn}><Plus size={13} /> {addLabel}</button>}
      </div>
      <DataTable columns={columns} rows={rows} onRowClick={setSelected} emptyText={emptyText} />
    </div>
  )
}
