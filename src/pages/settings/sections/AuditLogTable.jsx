/**
 * AuditLogTable — the audit log's scrollable table: sticky sortable headers, the
 * accessible sort buttons, and one row per activity entry (incl. the compact
 * before/after diff cells and the muted access-event styling).
 *
 * Pulled out of AuditLog.jsx because the table is one closed thing: it owns the sticky
 * header contract (the overflow container MUST wrap it), the TH/TD styling and the
 * per-column markup. The screen around it only decides WHICH rows to hand over.
 */
import { ChevronUp, ChevronDown as ChevronDn, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LogBadge, isAccessEvent, entityLabel } from './auditShared'
import { buildDiffCells } from './auditDiffCells'
import { Caption } from '@/components/ui/typography'

// Sort chevron indicator for a column header.
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronDn size={10} style={{ opacity: 0.25, marginLeft: 3 }} />
  return sortDir === 'asc'
    ? <ChevronUp  size={10} style={{ color: 'var(--color-primary-text)', marginLeft: 3 }} />
    : <ChevronDn  size={10} style={{ color: 'var(--color-primary-text)', marginLeft: 3 }} />
}

// Props: the page of rows to render, the active sort, and the two callbacks the
// screen owns (sorting the full list, opening the drill-down drawer).
export default function AuditLogTable({ rows, sortCol, sortDir, onSort, onRowClick }) {
  const { t } = useTranslation('settings')
  // Reuses the existing common.sort key for the sortable header's button tooltip
  // (mirrors DataTable's own sortable header — no new i18n keys needed).
  const { t: tCommon } = useTranslation('common')

  // Sticky TH style — header stays visible while scrolling the table.
  const TH = (col) => ({
    padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
    color: sortCol === col ? 'var(--color-primary-text)' : 'var(--text-muted)',
    background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', cursor: col ? 'pointer' : 'default',
    position: 'sticky', top: 0, zIndex: 2,
    userSelect: 'none',
  })
  const TD = { padding: '10px 10px', fontSize: 12, color: 'var(--text)',
               borderBottom: '1px solid var(--hover-bg)', verticalAlign: 'top' }

  // Accessible sortable header: a real <button> inside the <th> (not tabIndex+
  // onKeyDown on the th) for Tab reachability + native Enter/Space activation,
  // plus aria-sort on the th itself — mirrors the shared DataTable's sortable
  // header exactly, while keeping the existing TH(col)/SortIcon visual intact.
  const renderSortableTh = (col, label, width) => {
    const active = sortCol === col
    const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
    const { padding: thPadding, ...thStyleRest } = TH(col)
    return (
      <th key={col} style={{ ...thStyleRest, width }} aria-sort={ariaSort}>
        <button type="button" onClick={() => onSort(col)} title={tCommon('sort')}
          style={{ all: 'unset', boxSizing: 'border-box', display: 'inline-flex', width: '100%',
            padding: thPadding, cursor: 'pointer', userSelect: 'none', alignItems: 'center', font: 'inherit', color: 'inherit' }}>
          {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
        </button>
      </th>
    )
  }

  return (
    /* Scrollable table container — sticky header works because overflow is here */
    <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ overflowY: 'auto', flex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
        <thead>
          <tr>
            {renderSortableTh('created_at', t('audit.colDate'), 90)}
            <th style={{ ...TH(null), width: 60 }}>
              {t('audit.colTime')}
            </th>
            {renderSortableTh('causer_name', t('audit.colWho'), 120)}
            {renderSortableTh('log_name', t('audit.colType'), 120)}
            <th style={{ ...TH(null), width: 150 }}>{t('audit.colEntity')}</th>
            {renderSortableTh('description', t('audit.colAction'), 280)}
            <th style={TH(null)}>{t('audit.colOldValue')}</th>
            <th style={TH(null)}>{t('audit.colNewValue')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ ...TD, textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                {t('audit.noEntries')}
              </td>
            </tr>
          ) : rows.map((entry, i) => {
            const { beforeCell, afterCell } = buildDiffCells(entry, t)
            // Access (read) rows render muted with a leading eye icon — visually
            // distinct from a write event at a glance, without hiding the row.
            const access = isAccessEvent(entry)
            return (
              <tr key={entry.id ?? i} style={{ cursor: 'pointer', opacity: access ? 0.72 : 1 }}
                onClick={() => onRowClick(entry)}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 500 }}>
                  {new Date(entry.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </td>
                <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(entry.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={TD}>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>{entry.causer_name ?? t('audit.system')}</div>
                </td>
                <td style={TD}><LogBadge logName={entry.log_name} /></td>
                <td style={TD}>
                  {entry.subject_type ? (
                    <>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>{entityLabel(entry.subject_type, t)}</div>
                      {entry.subject_label && <Caption as="div">{entry.subject_label}</Caption>}
                    </>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ ...TD, fontWeight: 500, color: access ? 'var(--text-muted)' : 'var(--text)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {access && <Eye size={12} aria-label={t('audit.kind.access')} style={{ flexShrink: 0 }} />}
                    {entry.description}
                  </span>
                </td>
                <td style={{ ...TD, fontSize: 11, color: 'var(--color-danger-text)' }}>{beforeCell}</td>
                <td style={{ ...TD, fontSize: 11, color: 'var(--color-success-text)' }}>{afterCell}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
