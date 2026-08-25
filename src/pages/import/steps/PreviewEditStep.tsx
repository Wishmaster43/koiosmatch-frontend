/**
 * PreviewEditStep (wizard step 3) — "preview van de data, met de mogelijkheid rijen
 * aan te passen" (Danny) — "preview of the data, with the ability to adjust rows":
 * an editable grid of the mapped rows EXACTLY as they will
 * be sent, a "Run preview" button that dry-runs that exact data, and — once a
 * validate succeeds against the CURRENT rows — the real per-row report and Confirm
 * button, reused unchanged from the settings import wizard (PreviewStep).
 *
 * Any edit after a successful validate flips `dirty` back to true (useMappingWizard),
 * which hides the confirm section again: the real import may only ever follow a
 * dry-run of what is about to be sent, never a stale one.
 */
import { useTranslation } from 'react-i18next'
import { PreviewStep } from '@/pages/settings/shared'
import { fieldLabel } from '../lib/fieldLabels'
import type { ColumnMapping } from '../lib/mapping'
import type { ImportRunResult } from '../api'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

type AsyncStatus = 'idle' | 'loading' | 'error' | 'success'

interface PreviewEditStepProps {
  entity: string
  targetColumns: string[]
  mapping: ColumnMapping
  editableRows: Array<Record<string, string>>
  dirty: boolean
  onEditCell: (rowIndex: number, column: string, value: string) => void
  onValidate: () => void
  previewStatus: AsyncStatus
  previewError?: string
  previewResult?: ImportRunResult
  runStatus: AsyncStatus
  runError?: string
  canImport: boolean
  wholeTree: boolean
  onConfirm: () => void
  onBackToMapping: () => void
}

export default function PreviewEditStep({
  entity, targetColumns, mapping, editableRows, dirty, onEditCell, onValidate,
  previewStatus, previewError, previewResult, runStatus, runError, canImport, wholeTree, onConfirm, onBackToMapping,
}: PreviewEditStepProps) {
  const { t } = useTranslation(['settings', 'customers'])
  const mappedColumns = targetColumns.filter((column) => Object.values(mapping).includes(column))
  const validating = previewStatus === 'loading'
  // A row of the LAST successful dry-run, keyed by line number (header = line 1, so
  // the first data row is line 2) — correlates the server's own verdict with the row
  // the user is editing, exactly as ImportResultPanel shows it elsewhere.
  const outcomeFor = (rowIndex: number) => previewResult?.rows.find((row) => row.row === rowIndex + 2)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {t('import.wizard.preview.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {t('import.wizard.preview.subtitle')}
        </div>
      </div>

      {editableRows.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('import.wizard.preview.noRows')}
        </p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: 320 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--hover-bg)' }}>
                {/* A universal "#" needs no translation — the file's own line number,
                    matching how the reused ImportResultPanel labels the same row. */}
                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>#</th>
                {mappedColumns.map((column) => (
                  <th key={column} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                    {fieldLabel(t, entity, column)}
                  </th>
                ))}
                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }} />
              </tr>
            </thead>
            <tbody>
              {editableRows.map((row, rowIndex) => {
                const outcome = outcomeFor(rowIndex)
                return (
                  <tr key={rowIndex} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{rowIndex + 2}</td>
                    {mappedColumns.map((column) => (
                      <td key={column} style={{ padding: '3px 6px' }}>
                        <input value={row[column] ?? ''} onChange={(e) => onEditCell(rowIndex, column, e.target.value)}
                          aria-label={fieldLabel(t, entity, column)}
                          style={{ width: '100%', minWidth: 120, height: 28, padding: '0 8px', fontSize: 12,
                                   border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }} />
                      </td>
                    ))}
                    <td style={{ padding: '4px 10px', color: outcome?.action === 'error' ? 'var(--color-danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {outcome ? t(`stats.${outcome.action}`, { ns: 'settings' }) : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <Button variant="primary" onClick={onValidate} disabled={validating || editableRows.length === 0}>
          {validating && <Spinner size={14} />}
          {validating ? t('import.runningPreview', { ns: 'settings' }) : t('import.runPreview', { ns: 'settings' })}
        </Button>
        {dirty && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {t('import.wizard.preview.validateHint', { ns: 'settings' })}
          </span>
        )}
      </div>

      {previewStatus === 'error' && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-danger-text)' }}>
          {previewError || t('import.previewErrorFallback', { ns: 'settings' })}
        </p>
      )}

      {/* Only once a validate succeeded against the CURRENT rows: the real per-row
          report + Confirm, reused unchanged from the settings import wizard. */}
      {!dirty && previewStatus === 'success' && previewResult && (
        <div style={{ marginTop: 20 }}>
          <PreviewStep result={previewResult} runStatus={runStatus} runError={runError}
            canImport={canImport} wholeTree={wholeTree} onConfirm={onConfirm} onBack={onBackToMapping} />
        </div>
      )}
    </div>
  )
}
