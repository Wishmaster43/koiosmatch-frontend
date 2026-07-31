/**
 * ResultStep — step 3: the REAL outcome, reported with the exact same per-row panel
 * as the preview — never a bare checkmark. A partial result ("3 of 40 rows failed")
 * is shown as plainly as full success; that honesty is the whole point of this build.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import ImportResultPanel from './ImportResultPanel'
import type { ImportRunResult } from './importApi'

interface ResultStepProps {
  result: ImportRunResult
  onReset: () => void
}

export default function ResultStep({ result, onReset }: ResultStepProps) {
  const { t } = useTranslation('settings')
  const [showAllRows, setShowAllRows] = useState(false)
  const hasErrors = result.summary.error > 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
        {hasErrors
          ? <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          : <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('import.result.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {hasErrors
              ? t('import.result.subtitlePartial', { errorCount: result.summary.error, total: result.summary.rows })
              : t('import.result.subtitleSuccess')}
          </div>
        </div>
      </div>

      <ImportResultPanel result={result} showAllRows={showAllRows} onToggleShowAll={() => setShowAllRows((v) => !v)} />

      <button type="button" onClick={onReset}
        style={{ marginTop: 20, height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)',
                 borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
        {t('import.result.newImport')}
      </button>
    </div>
  )
}
