// Extracted from DataTable (SIZE-SPLIT-B, zero behaviour change): the <thead>
// row — select-all checkbox, expand spacer, and per-column sort headers.
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import SortCaret from './SortCaret'
import { checkboxCol, expandCol } from './dataTableUtils'
import type { Column } from './DataTable'

interface SortState { key: string; dir: 'asc' | 'desc' }

// Renders the sortable/select-all header row for the shared DataTable.
export default function DataTableHead<Row>({
  columns, selectable, expandable, stickyHeader, stickyColStyle, sort, toggleSort,
  allSelected, someSelected, selectionBusy, pageIds, onToggleAll,
}: {
  columns: Column<Row>[]; selectable: boolean; expandable: boolean; stickyHeader: boolean
  stickyColStyle: (i: number, bg?: string) => CSSProperties
  sort: SortState | null; toggleSort: (col: Column<Row>) => void
  allSelected: boolean; someSelected: boolean; selectionBusy: boolean
  pageIds: Array<string | number>; onToggleAll?: (ids: Array<string | number>, allSelected: boolean) => void
}) {
  const { t } = useTranslation('common')
  // Sticky offset applied to every <th> when stickyHeader is enabled.
  const stickyTh: CSSProperties = stickyHeader ? { position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)' } : {}

  return (
    <thead>
      <tr style={{ borderBottom: '2px solid var(--border)' }}>
        {selectable && (
          <th style={{ ...checkboxCol, ...stickyTh }}>
            {/* SELECT-RACE-1: inert (disabled + aria-disabled) while a fresh
                server result is in flight, so "select all" can never be
                clicked against rows about to be replaced. */}
            <input type="checkbox" checked={allSelected}
              disabled={selectionBusy}
              aria-disabled={selectionBusy || undefined}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
              onChange={() => onToggleAll?.(pageIds, allSelected)}
              style={{ cursor: selectionBusy ? 'not-allowed' : 'pointer', accentColor: 'var(--color-primary)' }} aria-label={t('selectAll')} />
          </th>
        )}
        {expandable && <th style={{ ...expandCol, ...stickyTh }} aria-hidden="true" />}
        {columns.map((col, i) => {
          const active = sort?.key === col.key
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- this IS the <th> element's own style object (padding/align/sticky-offset all mixed in), not a text node the Caption atom could wrap (§14 r7 necessity)
          const baseStyle: CSSProperties = { padding: '8px 10px', textAlign: col.align ?? 'left', fontSize: 11,
            fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap',
            ...(col.width ? { minWidth: col.width, width: col.width } : {}),
            ...stickyTh, ...stickyColStyle(i),
            // sticky header + sticky col: bump zIndex so corner cell stays above both axes.
            // HUISSTIJL-1: 1/2/3 here order STICKY SIBLINGS within this one table, not
            // app-wide stacking context — internal layering, exempt from the z-ladder.
            ...(stickyHeader && col.sticky ? { zIndex: 3 } : {}) }
          if (!col.sortable) {
            return <th key={col.key} style={baseStyle}>{col.header}</th>
          }
          const justify = col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'
          // aria-sort lives on the th itself (the columnheader role AT relies on);
          // 'none' for every column that isn't the active sort, never omitted, so
          // screen readers can tell an unsorted sortable column from a plain one.
          const ariaSort: 'ascending' | 'descending' | 'none' = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'
          // Padding moves from the th onto the button below so the clickable/focusable
          // area matches the original full-cell hit region exactly.
          const { padding: thPadding, ...thStyleRest } = baseStyle
          return (
            <th key={col.key} style={thStyleRest} aria-sort={ariaSort}>
              {/* A real <button> inside the th (not tabIndex+onKeyDown on the th) — the
                  conventional accessible-sort pattern: the th keeps its columnheader
                  semantics, the button gets focus + native Enter/Space activation for
                  free (WCAG 2.1.1 Keyboard, 4.1.2 Name/Role/Value). `all: unset` strips
                  the browser's default button chrome; the explicit properties below
                  restore the exact look the old <span> had (inherited color/font/
                  white-space come back automatically since those are inherited CSS
                  properties, unset just means "use the parent's value" for them). */}
              <button type="button" onClick={() => toggleSort(col)} title={t('sort')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the sort trigger fills the whole <th> hit-region via `all: unset` so it inherits the header's own padding/align/sticky styling; Button's fixed sm chrome cannot stretch to an arbitrary table header cell (§14 r7 necessity)
                style={{ all: 'unset', boxSizing: 'border-box', display: 'inline-flex', width: '100%',
                  padding: thPadding, cursor: 'pointer', userSelect: 'none', alignItems: 'center', gap: 3,
                  justifyContent: justify, font: 'inherit', color: 'inherit' }}>
                {col.header}
                {/* One shared caret recipe (HUISSTIJL-1): active is coloured, everywhere. */}
                <SortCaret active={!!active} dir={sort?.dir} />
              </button>
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
