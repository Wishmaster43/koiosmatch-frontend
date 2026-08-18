/**
 * PreviewStep — step 2: the mandatory dry-run report. Nothing is written yet; the
 * Confirm button is the ONLY path to the real POST, and only lights up once the
 * preview found at least one row that would land (never offer a real import before
 * a preview has run — the exact bug this wizard replaces).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import ImportResultPanel from './ImportResultPanel'
import type { ImportRunResult } from './importApi'
import Button from '@/components/ui/Button'

interface PreviewStepProps {
  result: ImportRunResult
  runStatus: 'idle' | 'loading' | 'error' | 'success'
  runError?: string
  canImport: boolean
  onConfirm: () => void
  onBack: () => void
  /** True for the combined whole-customer file: one row can touch four records. */
  wholeTree?: boolean
}

export default function PreviewStep({ result, runStatus, runError, canImport, onConfirm, onBack, wholeTree = false }: PreviewStepProps) {
  const { t } = useTranslation('settings')
  const [showAllRows, setShowAllRows] = useState(false)
  // The real import is pointless (and stays disabled) when nothing would land.
  const nothingToImport = result.summary.create + result.summary.update === 0
  const confirming = runStatus === 'loading'
  const confirmDisabled = !canImport || nothingToImport || confirming

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('import.preview.title')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('import.preview.subtitle')}</div>
      </div>

      <ImportResultPanel result={result} wholeTree={wholeTree}
        showAllRows={showAllRows} onToggleShowAll={() => setShowAllRows((v) => !v)} />

      {nothingToImport && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, padding: '10px 12px',
          background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
          borderRadius: 8, fontSize: 12, color: 'var(--text)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} aria-hidden="true" />
          {t('import.preview.nothingToImport')}
        </div>
      )}

      {runStatus === 'error' && (
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--color-danger)' }}>
          {runError || t('import.preview.confirmError')}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <Button variant="secondary" onClick={onBack} disabled={confirming}>
          {t('import.preview.back')}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled}
          title={canImport ? undefined : t('import.noImportPermission')}>
          {confirming && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {confirming ? t('import.preview.running') : t('import.preview.confirm')}
        </Button>
      </div>
    </div>
  )
}
