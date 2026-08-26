/**
 * PasteCvCard — the progress/result strip for the "pasted CV text" entry point
 * (PASTE-CV-1, 13-08: started via the header's CvEntryIcons paste popover),
 * hitting the SAME /candidates/parse-cv route+poll (raw_text body instead of a
 * file) and the SAME buildCvPrefill mapping — no second proposal pipeline.
 * Renders nothing while idle (busy / ready / error only) — the paste textarea
 * itself now lives in the header popover, not a full-width banner card.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import Spinner from '@/components/ui/Spinner'
import type { CvPhase } from './useCvParse'
import type { CvPrefillResult } from './cvPrefill'
import { cardHead, cardBox } from './fields'

interface PasteCvCardProps {
  phase: CvPhase
  errorKey: string | null
  summary: CvPrefillResult | null
  onReset: () => void
}

const ghostBtn = {
  height: BTN_H, padding: '0 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'none', color: 'var(--text)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
} as const

// See the file's top doc above; renders nothing while idle, only once a paste has actually been submitted.
export default function PasteCvCard({ phase, errorKey, summary, onReset }: PasteCvCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const busy = phase === 'uploading' || phase === 'processing'

  // Nothing to show until text has actually been submitted from the header popover.
  if (phase === 'idle') return null

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{t('modal.cvPaste.title')}</div>
      <div style={{ ...cardBox, gap: 8, padding: 10 }}>

        {busy && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <Spinner size={14} />
            {phase === 'uploading' ? t('modal.cv.uploading') : t('modal.cv.reading')}
            <button type="button" onClick={onReset} style={{ ...ghostBtn, marginLeft: 'auto' }}>{t('common:cancel')}</button>
          </div>
        )}

        {phase === 'ready' && summary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="var(--color-success)" />
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('modal.cv.filled', { count: summary.filled.length })}</span>
              <AiGeneratedLabel />
            </div>
            {summary.skipped.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cv.skipped', { count: summary.skipped.length })}</div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('modal.cv.noFreeText')}</div>
          </div>
        )}

        {phase === 'error' && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AlertTriangle size={15} color="var(--color-danger)" />
            <span style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t(errorKey ?? 'modal.cv.error.generic')}</span>
            <button type="button" onClick={onReset} style={{ ...ghostBtn, marginLeft: 'auto' }}>
              <RotateCcw size={13} /> {t('modal.cv.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
