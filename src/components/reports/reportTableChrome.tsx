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
import { captionStyle, bodyTextStyle } from '@/components/ui/typography'
import type { SortState } from '@/types/reports'

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
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{summary}</p>
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
