/**
 * reportTableChrome — the shared presentational scaffolding for the SM report
 * tables (CustomersTable/LocationsTable/DepartmentsTable/MessagesTable under
 * components/reports): the header cell/body cell style tokens, the sortable
 * `<thead>` row and the title+summary+search toolbar. These four tables cannot
 * adopt the generic `DataTable` (they paginate client-side BEFORE handing rows
 * to the table, so DataTable's own internal sort would only reorder the current
 * page — see CustomersTable.test.tsx); this file is their equivalent chrome so
 * each table only declares its columns and its data.
 */
import { useTranslation } from 'react-i18next'
import type { CSSProperties, ReactNode } from 'react'
import { Search } from 'lucide-react'
import SortCaret from '@/components/ui/SortCaret'
import Spinner from '@/components/ui/Spinner'
import { captionStyle, bodyTextStyle, pageTitleStyle } from '@/components/ui/typography'
import type { SortState } from '@/types/reports'
import ReportEmptyState from './ReportEmptyState'

// Shared header-cell chrome — spreads the Caption identity (11/400/muted) so
// this reads as a reused atom, not a re-declared one; fontWeight bumps to 600
// for header emphasis on top. Exported alongside the components below, so the
// disable is the HMR-only-export nicety, nothing style-related.
// eslint-disable-next-line react-refresh/only-export-components -- TH/TD are shared style objects exported alongside the components below (HMR nicety only)
export const TH: CSSProperties = { ...captionStyle, padding: '8px 12px', textAlign: 'left', fontWeight: 600,
             background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
             whiteSpace: 'nowrap', userSelect: 'none' }
// Shared body-cell chrome — the BodyText identity (13/400/--text/1.5) plus cell
// padding; the old cells inherited 1.5 from the preflight, so no override here.
// eslint-disable-next-line react-refresh/only-export-components -- see TH above
export const TD: CSSProperties = { ...bodyTextStyle, padding: '10px 12px',
             borderBottom: '1px solid var(--hover-bg)' }

// One column declaration a report table hands to SortableTableHead.
export interface ReportTableColumn { key: string; label: ReactNode; sortable?: boolean }

// Renders the `<thead><tr>` for a report table: a plain header for a non-sortable
// column, or a real keyboard-reachable <button> + aria-sort for a sortable one
// (mirrors the shared DataTable's own sortable header exactly).
export function SortableTableHead({ columns, sort, onSort }: {
  columns: ReportTableColumn[]
  sort: SortState
  onSort: (key: string) => void
}) {
  // Reuses the existing common.sort key for the sortable header's button tooltip
  // (mirrors DataTable's own sortable header — no new i18n keys needed).
  const { t: tCommon } = useTranslation('common')
  return (
    <thead>
      <tr>
        {columns.map(col => {
          // Plain header — no sort affordance, no aria-sort (mirrors DataTable's
          // own non-sortable column, which never gets aria-sort either).
          if (!col.sortable) return <th key={col.key} style={TH}>{col.label}</th>
          const active = sort.key === col.key
          // Present ('none' for inactive) on EVERY sortable column so a screen
          // reader can tell it is sortable at all, not just the active one.
          const ariaSort: 'ascending' | 'descending' | 'none' =
            active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
          // The button below absorbs TH's own padding into its hit-region (the
          // whole header cell, not just the text, stays clickable) — this <th>
          // keeps every other TH property but drops padding to avoid doubling it.
          const thStyleRest: CSSProperties = { ...TH, padding: undefined }
          return (
            <th key={col.key} style={thStyleRest} aria-sort={ariaSort}>
              {/* Real <button> inside the <th> (not tabIndex+onKeyDown on the th) —
                  gives Tab reachability + native Enter/Space activation; mirrors the
                  shared DataTable's sortable header exactly. The reset (all:unset +
                  hit-region) is a real CSS class (index.css `.report-th-sort-btn`),
                  not an inline style — every value it needs is static across the
                  whole report-table family, so there is nothing left to compute. */}
              <button type="button" className="report-th-sort-btn" onClick={() => onSort(col.key)} title={tCommon('sort')}>
                {col.label}
                <SortCaret active={active} dir={sort.dir} />
              </button>
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

// Shared title + result-count summary + search box header, identical across
// every report table; only the resolved copy and the search value differ, so
// callers pass already-translated strings rather than i18n keys.
export function ReportTableToolbar({ title, summary, searchValue, onSearchChange, searchPlaceholder }: {
  title: string
  summary: string
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
}) {
  return (
    <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
      <div>
        {/* pageTitleStyle raw identity (not a hand-picked size/weight pair, §4 typography) */}
        <h1 style={{ ...pageTitleStyle, fontSize: 18 }}>{title}</h1>
        <p style={{ ...captionStyle, marginTop: 2 }}>{summary}</p>
      </div>
      <div className="relative">
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                   transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        {/* bodyTextStyle spread (not a hand-picked fontSize/color pair): a native
            <input> can't wrap the BodyText atom, so its typography rides the same
            raw identity via spread — mirrors RunsTable's own search input exactly. */}
        <input value={searchValue} onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ ...bodyTextStyle, height: 34, width: 260, paddingLeft: 32, paddingRight: 12,
                   border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
      </div>
    </div>
  )
}

// Clickable table row with hover effect — used by all four report tables
// (LocationsTable, DepartmentsTable, CustomersTable, MessagesTable) to render
// the interactive <tr> that opens a drill-down on click.
export function ReportRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <tr
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </tr>
  )
}

// Shared frame wrapping a report table: outer/inner divs, loading block, and empty state.
// Renders the centred loading spinner/message, an empty-state message, or the table
// children by state. Adopted by LocationsTable (text-only), DepartmentsTable (text-only),
// and CustomersTable (spinner variant); MessagesTable keeps its own frame (in-table
// loading/error rows).
export function ReportTableFrame({ loading, loadingLabel, empty, emptyLabel, emptyHeight, spinner = false, loadingHeight = 200, children }: {
  loading: boolean
  loadingLabel: string
  empty: boolean
  emptyLabel: string
  emptyHeight?: number
  spinner?: boolean
  loadingHeight?: number
  children: ReactNode
}) {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
      style={{ border: '1px solid var(--border)' }}>
      <div className="flex-1 min-w-0 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3" style={{ height: loadingHeight }}>
            {spinner && <span style={{ color: 'var(--border)' }}><Spinner size={18} /></span>}
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loadingLabel}</p>
          </div>
        ) : empty ? (
          <ReportEmptyState message={emptyLabel} height={emptyHeight} />
        ) : (
          children
        )}
      </div>
    </div>
  )
}

// Full table body shared by DepartmentsTable/LocationsTable: the ReportTableFrame
// with the sortable head + one row per entry (cells are a render prop — they
// differ per entity), then the pagination footer and the optional drill drawer,
// both as slots. The footer stays a slot on purpose: PaginationBar reaches
// lib/formatters and so lib/datetime and the i18n singleton, which this chrome
// module must never pull into its consumers (DATETIME-IMPORT-LES, R10-COMMON 8).
export function ReportTableShell<T extends { id?: string | number }>({
  loading, loadingLabel, empty, emptyLabel,
  columns, sort, onSort,
  rows, renderRow,
  pagination,
  drawer,
}: {
  loading: boolean
  loadingLabel: string
  empty: boolean
  emptyLabel: string
  columns: ReportTableColumn[]
  sort: SortState
  onSort: (key: string) => void
  rows: T[]
  renderRow: (row: T, index: number) => ReactNode
  // The caller's own <PaginationBar/> (see the note above the component).
  pagination?: ReactNode
  drawer?: ReactNode
}) {
  return (
    <>
      <ReportTableFrame loading={loading} loadingLabel={loadingLabel} empty={empty} emptyLabel={emptyLabel}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <SortableTableHead columns={columns} sort={sort} onSort={onSort} />
          <tbody>
            {rows.map((r, i) => renderRow(r, i))}
          </tbody>
        </table>
      </ReportTableFrame>

      {pagination}

      {drawer}
    </>
  )
}
