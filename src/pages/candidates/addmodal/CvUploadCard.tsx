/**
 * CvUploadCard — the progress/result strip for the "from a CV" entry point
 * (started via the header's CvEntryIcons, PASTE-CV-1 sibling: the file-upload
 * icon). Presentational: parse phase + result summary in, `onReset` callback
 * out; the upload/poll itself lives in useCvParse and the mapping in cvPrefill.
 *
 * It PREFILLS, it never saves — the copy says so, because that is the whole safety
 * model: the recruiter reviews every filled field and confirms with the normal
 * create button. Renders nothing while idle (busy / ready / error only) — the
 * idle "choose a CV" affordance moved into the header icon (Danny 13-08: the two
 * banner cards read as clutter, not an invitation).
 */
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import type { CvPhase } from './useCvParse'
import type { CvPrefillResult } from './cvPrefill'
import { cardHead, cardBox } from './fields'

interface CvUploadCardProps {
  phase: CvPhase
  /** i18n key of the honest failure message, or null. */
  errorKey: string | null
  fileName: string | null
  /** What the parse actually did to the form — only present once ready. */
  summary: CvPrefillResult | null
  onReset: () => void
}

// Ghost button used for cancel / retry / another-CV — one style, three labels.
const ghostBtn = {
  height: BTN_H, padding: '0 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'none', color: 'var(--text)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
} as const

export default function CvUploadCard({ phase, errorKey, fileName, summary, onReset }: CvUploadCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const busy = phase === 'uploading' || phase === 'processing'

  // Nothing to show until a file has actually been picked from the header icon.
  if (phase === 'idle') return null

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{t('modal.cv.title')}</div>
      <div style={{ ...cardBox, gap: 8, padding: 10 }}>

        {/* Busy: uploading or waiting on the queued parse — with a real cancel. */}
        {busy && (
          <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Loader2 size={15} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {phase === 'uploading' ? t('modal.cv.uploading') : t('modal.cv.reading')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {phase === 'processing' ? t('modal.cv.readingHint') : fileName}
              </div>
            </div>
            <button type="button" onClick={onReset} style={{ ...ghostBtn, marginLeft: 'auto' }}>{t('modal.cv.cancel')}</button>
          </div>
        )}

        {/* Ready: what was filled, what was left alone, what this form cannot hold. */}
        {phase === 'ready' && summary && (
          <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="var(--color-success)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {summary.filled.length
                  ? t('modal.cv.filled', { count: summary.filled.length })
                  : t('modal.cv.none')}
              </span>
              <button type="button" onClick={onReset} style={{ ...ghostBtn, marginLeft: 'auto' }}>
                <RotateCcw size={13} /> {t('modal.cv.another')}
              </button>
            </div>
            {summary.filled.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--color-primary-text)', fontWeight: 600 }}>{t('modal.cv.checkNotice')}</div>
                {/* AI-Act disclosure (AI-ACT-1): the fields above were read/filled
                    by Koios AI from the cv, not typed by the recruiter. */}
                <AiGeneratedLabel />
              </>
            )}
            {summary.skipped.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cv.skipped', { count: summary.skipped.length })}</div>
            )}
            {summary.unreadableDate && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cv.unreadableDate')}</div>
            )}
            {summary.extras.experiences > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cv.extraExperiences', { count: summary.extras.experiences })}</div>
            )}
            {summary.extras.educations > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cv.extraEducations', { count: summary.extras.educations })}</div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('modal.cv.noFreeText')}</div>
          </div>
        )}

        {/* Error: one translated line — never a raw server string — plus a retry. */}
        {phase === 'error' && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AlertTriangle size={15} color="var(--color-danger)" />
            <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t(errorKey ?? 'modal.cv.error.generic')}</span>
            <button type="button" onClick={onReset} style={{ ...ghostBtn, marginLeft: 'auto' }}>{t('modal.cv.retry')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
