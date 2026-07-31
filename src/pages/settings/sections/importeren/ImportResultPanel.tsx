/**
 * ImportResultPanel — the shared per-row report for BOTH the dry-run preview and
 * the real import result (§3A reuse: one code path, so the preview never promises
 * something the real run shows differently — mirrors ImportRunner::run itself).
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
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
}

export default function ImportResultPanel({ result, showAllRows, onToggleShowAll }: ImportResultPanelProps) {
  const { t } = useTranslation('settings')
  const { summary, unknown_columns: unknownColumns, rows } = result
  const errorRows = rows.filter((row) => row.action === 'error')
  const visibleRows = showAllRows ? rows : errorRows

  return (
    <div>
      {/* Summary counts — one soft chip per outcome, never a bare "done". */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['rows', 'create', 'update', 'skip', 'error'] as const).map((key) => (
          <SoftChip key={key} color={STAT_COLORS[key]} label={`${t(`import.stats.${key}`)}: ${summary[key]}`} />
        ))}
      </div>

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

      {/* Per-row detail — errors by default, full list on demand. 2000 rows is the
          backend's hard cap (CsvFile::MAX_ROWS), so a plain scroll container is
          enough here; no virtualization library needed at this scale. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {showAllRows
            ? t('import.rows.allTitle', { count: rows.length })
            : t('import.rows.errorTitle', { count: errorRows.length })}
        </span>
        {rows.length > errorRows.length && (
          <button type="button" onClick={onToggleShowAll}
            style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {showAllRows ? t('import.rows.showErrorsOnly') : t('import.rows.showAll', { count: rows.length })}
          </button>
        )}
      </div>

      {visibleRows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('import.rows.noErrors')}</p>
      ) : (
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {visibleRows.map((row) => (
            <div key={row.row} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px',
              borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <SoftChip color={STAT_COLORS[row.action]} label={t(`import.stats.${row.action}`)} />
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{t('import.rows.row', { row: row.row })}</span>
              {row.reference && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{row.reference}</span>}
              {row.messages.length > 0 && <span style={{ color: 'var(--text)' }}>{row.messages.join(' · ')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
