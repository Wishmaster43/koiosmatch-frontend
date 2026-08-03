/**
 * ScopedListTab — the ONE generic list body for a customer department/location's
 * scoped sub-tabs (Vacatures, Matches — SCOPED-LIST-TAB-1). Config-driven (§3A):
 * the caller supplies the endpoint, the scope param name, a row mapper and a
 * column set; this component only owns the fetch-state chrome (search box +
 * optional add button + DataTable) and the four explicit UI states. Rows are
 * READ-ONLY here — clicking one opens the real entity via `onRowClick` (mirrors
 * EntityTasksTab's own openEntity click-through), never an inline edit.
 *
 * Point 1 (Danny's ten-point round): an optional `onAdd`/`addLabel` pair renders
 * the shared `DrawerAddButton` next to the search box — Vacatures and Matches
 * both need a "+" here, so the slot lives in the ONE shared body instead of a
 * bespoke toolbar per caller.
 */
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { useScopedEntityList } from '../hooks/useScopedEntityList'
import type { Id } from '@/types/common'

interface ScopedListTabProps<T> {
  /** React-query cache key prefix — unique per entity type (e.g. 'department-vacancies'). */
  queryKey: string
  endpoint: string
  paramName: string
  id: Id | undefined
  mapRow: (raw: Record<string, unknown>) => T
  columns: Column<T>[]
  /** Row keys the free-text search box narrows on. */
  searchKeys: (keyof T)[]
  searchPlaceholder: string
  emptyText: string
  loadingText: string
  errorText: string
  onRowClick?: (row: T) => void
  /** Point 1: renders a "+ …" button next to the search box when both are given. */
  onAdd?: () => void
  addLabel?: string
}

export default function ScopedListTab<T>({
  queryKey, endpoint, paramName, id, mapRow, columns, searchKeys,
  searchPlaceholder, emptyText, loadingText, errorText, onRowClick, onAdd, addLabel,
}: ScopedListTabProps<T>) {
  const [search, setSearch] = useState('')
  const { rows, loading, error } = useScopedEntityList<T>(queryKey, endpoint, paramName, id, mapRow)

  // Free-text search over the caller-chosen keys, client-side (mirrors VacanciesTab).
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row => searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(q)))
  }, [rows, search, searchKeys])

  // ERROR state: an id outside the caller's branch grant 404s (LOC-DEPT-TAB-1) —
  // an honest message, never a table that silently renders as "empty".
  if (error) {
    return <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger)', padding: '8px 0' }}>{errorText}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder} aria-label={searchPlaceholder}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        {onAdd && addLabel && <DrawerAddButton onClick={onAdd} label={addLabel} />}
      </div>
      <DataTable columns={columns} rows={filteredRows} loading={loading} loadingText={loadingText}
        emptyText={emptyText} onRowClick={onRowClick} />
    </div>
  )
}
