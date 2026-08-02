/**
 * ResultStep — step 3: the REAL outcome, reported with the exact same per-row panel
 * as the preview — never a bare checkmark. A partial result ("3 of 40 rows failed")
 * is shown as plainly as full success; that honesty is the whole point of this build.
 *
 * "Everything landed" now has to EARN itself twice: no failed rows AND no row that
 * was written with something dropped (an unknown industry, an ignored consent cell).
 * A row that imported minus a field is not a success story, so it gets its own
 * subtitle instead of being folded into the green one.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import ImportResultPanel from './ImportResultPanel'
import { countRemarkRows } from './importRowAttention'
import type { ImportRunResult } from './importApi'

interface ResultStepProps {
  result: ImportRunResult
  onReset: () => void
  /** True for the combined whole-customer file: one row can touch four records. */
  wholeTree?: boolean
}

export default function ResultStep({ result, onReset, wholeTree = false }: ResultStepProps) {
  const { t } = useTranslation('settings')
  const [showAllRows, setShowAllRows] = useState(false)
  const hasErrors = result.summary.error > 0
  const remarkCount = countRemarkRows(result.rows)
  const clean = !hasErrors && remarkCount === 0

  // One subtitle per real outcome: failed rows > partly-landed rows > all clean.
  const subtitle = hasErrors
    ? t('import.result.subtitlePartial', { errorCount: result.summary.error, total: result.summary.rows })
    : remarkCount > 0
      ? t('import.result.subtitleSuccessWithRemarks', { count: remarkCount })
      : t('import.result.subtitleSuccess')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
        {clean
          ? <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          : <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('import.result.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>

      <ImportResultPanel result={result} wholeTree={wholeTree}
        showAllRows={showAllRows} onToggleShowAll={() => setShowAllRows((v) => !v)} />

      <button type="button" onClick={onReset}
        style={{ marginTop: 20, height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)',
                 borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
        {t('import.result.newImport')}
      </button>
    </div>
  )
}
