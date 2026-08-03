/**
 * MapColumnsStep (wizard step 2) — "velden worden gekoppeld" (Danny): one row per
 * column found in the uploaded file, each with a select for which backend field it
 * feeds. Auto-mapped by header-name similarity on mount (useMappingWizard.loadFile);
 * every suggestion stays overridable here, and a column nobody claims is marked
 * "will be skipped" rather than silently dropped.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { fieldLabel } from '../lib/fieldLabels'
import { SKIP, missingRequiredColumns, unmappedSourceColumns, type ColumnMapping } from '../lib/mapping'

const SELECT_STYLE: CSSProperties = {
  height: 32, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', minWidth: 220,
}

interface MapColumnsStepProps {
  entity: string
  headers: string[]
  targetColumns: string[]
  mapping: ColumnMapping
  onChangeMapping: (sourceHeader: string, target: string) => void
  onNext: () => void
  onBack: () => void
}

export default function MapColumnsStep({ entity, headers, targetColumns, mapping, onChangeMapping, onNext, onBack }: MapColumnsStepProps) {
  const { t } = useTranslation(['settings', 'customers'])
  const skipped = unmappedSourceColumns(mapping)
  const missingRequired = missingRequiredColumns(mapping, entity)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {t('import.wizard.mapping.title', { defaultValue: 'Match your columns' })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {t('import.wizard.mapping.subtitle', { defaultValue: 'We matched what we recognised — check the rest and adjust where needed.' })}
        </div>
      </div>

      {headers.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('import.wizard.mapping.noColumns', { defaultValue: 'This file has no columns to map.' })}
        </p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '8px 12px', background: 'var(--hover-bg)', fontSize: 11,
            fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <span style={{ flex: 1 }}>{t('import.wizard.mapping.sourceColumn', { defaultValue: 'Column in your file' })}</span>
            <span style={{ flex: 1 }}>{t('import.wizard.mapping.targetField', { defaultValue: 'Maps to' })}</span>
          </div>
          {headers.map((header) => (
            <div key={header} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px',
              borderTop: '1px solid var(--border)', gap: 12 }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{header}</span>
              <div style={{ flex: 1 }}>
                <select value={mapping[header] ?? SKIP} onChange={(e) => onChangeMapping(header, e.target.value)}
                  aria-label={t('import.wizard.mapping.targetField', { defaultValue: 'Maps to' }) + `: ${header}`} style={SELECT_STYLE}>
                  <option value={SKIP}>{t('import.wizard.mapping.skipOption', { defaultValue: '— Do not import —' })}</option>
                  {targetColumns.map((column) => (
                    <option key={column} value={column}>{fieldLabel(t, entity, column)}</option>
                  ))}
                </select>
                {mapping[header] === SKIP && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
                    {t('import.wizard.mapping.skippedNotice', { defaultValue: 'This column will be skipped.' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {skipped.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {t('import.unknownColumns.hint')}
        </p>
      )}

      {missingRequired.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, padding: '10px 12px',
          background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
          borderRadius: 8, fontSize: 12, color: 'var(--text)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} aria-hidden="true" />
          {t('import.wizard.mapping.missingRequired', {
            defaultValue: `Still required: ${missingRequired.map((column) => fieldLabel(t, entity, column)).join(', ')}`,
            fields: missingRequired.map((column) => fieldLabel(t, entity, column)).join(', '),
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={onBack}
          style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
                   background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          {t('back', { ns: 'common' })}
        </button>
        <button type="button" onClick={onNext} disabled={missingRequired.length > 0 || headers.length === 0}
          style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8,
                   background: 'var(--color-primary)', color: 'white',
                   cursor: missingRequired.length > 0 || headers.length === 0 ? 'not-allowed' : 'pointer',
                   opacity: missingRequired.length > 0 || headers.length === 0 ? 0.5 : 1 }}>
          {t('import.wizard.next', { ns: 'settings', defaultValue: 'Next' })}
        </button>
      </div>
    </div>
  )
}
