/**
 * ImportResultPanel — the shared per-row report for BOTH the dry-run preview and
 * the real import result (§3A reuse: one code path, so the preview never promises
 * something the real run shows differently — mirrors ImportRunner::run itself).
 *
 * The default row list is every row that FAILED **or landed only partly**
 * (importRowAttention): a create row carrying "klant_branche: … left empty" is a
 * half-imported row, and a report that hides it behind "show all" tells the same
 * comfortable lie this screen was rebuilt to remove.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import { hasRemarks, needsAttention } from './importRowAttention'
import type { ImportRowAction, ImportRunResult } from './importApi'

// Colour per outcome — carries meaning (§4), reused for both the summary chips and
// the per-row badges so the same colour always means the same thing.
const STAT_COLORS: Record<'rows' | ImportRowAction, string> = {
  rows: 'var(--text-muted)',
  create: 'var(--color-success)',
  update: 'var(--color-info)',
  skip: 'var(--text-muted)',
  error: 'var(--color-danger)',
}

interface ImportResultPanelProps {
  result: ImportRunResult
  showAllRows: boolean
  onToggleShowAll: () => void
  /** True for the combined whole-customer file: one row can touch four records. */
  wholeTree?: boolean
}

// Shared per-row import report (see file docblock above); defaults to showing
// only failed-or-partial rows so a half-imported row is never hidden by default.
export default function ImportResultPanel({ result, showAllRows, onToggleShowAll, wholeTree = false }: ImportResultPanelProps) {
  const { t } = useTranslation('settings')
  const { summary, unknown_columns: unknownColumns, rows } = result
  const attentionRows = rows.filter(needsAttention)
  const remarkCount = attentionRows.filter(hasRemarks).length
  const visibleRows = showAllRows ? rows : attentionRows

  return (
    <div>
      {/* Summary counts — one soft chip per outcome, never a bare "done". The
          server-side counts come first; the client-derived "with remarks" count only
          appears when there is one, so a clean import stays quiet. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {(['rows', 'create', 'update', 'skip', 'error'] as const).map((key) => (
          <SoftChip key={key} color={STAT_COLORS[key]} label={`${t(`import.stats.${key}`)}: ${summary[key]}`} />
        ))}
        {remarkCount > 0 && (
          <SoftChip color="var(--color-warning)" label={`${t('import.stats.remarks')}: ${remarkCount}`} />
        )}
      </div>

      {/* The counts are ROWS. For the combined file one row can create a customer, a
          location, a department AND a contact, so "New: 3" is never "3 records". */}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        {wholeTree ? t('import.stats.rowsAreRowsTree') : t('import.stats.rowsAreRows')}
      </p>

      {/* Unknown columns — a NOTICE, never an error: a client may keep its own
          bookkeeping column in the file without being locked out of the import. */}
      {unknownColumns.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px',
          background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
          borderRadius: 8, marginBottom: 16 }}>
          <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('import.unknownColumns.title')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('import.unknownColumns.hint')}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {unknownColumns.map((col) => <SoftChip key={col} label={col} color="var(--color-warning)" />)}
            </div>
          </div>
        </div>
      )}

      {/* Per-row detail — failed/partly-landed rows by default, full list on demand.
          2000 rows is the backend's hard cap (CsvFile::MAX_ROWS), so a plain scroll
          container is enough here; no virtualization library needed at this scale. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {showAllRows
            ? t('import.rows.allTitle', { count: rows.length })
            : t('import.rows.attentionTitle', { count: attentionRows.length })}
        </span>
        {rows.length > attentionRows.length && (
          <button type="button" onClick={onToggleShowAll}
            style={{ fontSize: 12, color: 'var(--color-primary-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            {showAllRows ? t('import.rows.showAttentionOnly') : t('import.rows.showAll', { count: rows.length })}
          </button>
        )}
      </div>

      {visibleRows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('import.rows.noAttention')}</p>
      ) : (
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {visibleRows.map((row) => (
            <div key={row.row} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px',
              borderBottom: '1px solid var(--border)', fontSize: 12, flexWrap: 'wrap' }}>
              <SoftChip color={STAT_COLORS[row.action]} label={t(`import.stats.${row.action}`)} />
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{t('import.rows.row', { row: row.row })}</span>
              {/* The reference is the record path this row touched ("Klant / Locatie /
                  Afdeling / Persoon" for the combined file) — it must wrap, not clip. */}
              {row.reference && <span style={{ color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'anywhere' }}>{row.reference}</span>}
              {row.messages.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'flex-start', gap: 5, minWidth: 0, overflowWrap: 'anywhere',
                  color: hasRemarks(row) ? 'var(--color-warning)' : 'var(--text)' }}>
                  {/* Icon + colour together, never colour alone (§6). */}
                  {hasRemarks(row) && <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />}
                  {hasRemarks(row) ? `${t('import.rows.remark')} ${row.messages.join(' · ')}` : row.messages.join(' · ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
