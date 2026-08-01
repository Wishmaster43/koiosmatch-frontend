/**
 * CvUploadCard — the "maak deze kandidaat vanuit een cv" entry in the create modal.
 * Presentational: parse phase + result summary in, `onFile`/`onReset` callbacks out;
 * the upload/poll itself lives in useCvParse and the mapping in cvPrefill.
 *
 * It PREFILLS, it never saves — the copy says so, because that is the whole safety
 * model: the recruiter reviews every filled field and confirms with the normal
 * create button. All four states are rendered (idle / busy / ready / error).
 */
import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'
import { CV_ACCEPT_MIME } from './useCvParse'
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
  onFile: (file: File) => void
  onReset: () => void
}

// Ghost button used for cancel / retry / another-CV — one style, three labels.
const ghostBtn = {
  height: BTN_H, padding: '0 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'none', color: 'var(--text)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
} as const

export default function CvUploadCard({ phase, errorKey, fileName, summary, onFile, onReset }: CvUploadCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = phase === 'uploading' || phase === 'processing'

  // Hand the chosen file up, then clear the input so picking the SAME file again
  // still fires a change event (browsers suppress an identical value).
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{t('modal.cv.title')}</div>
      <div style={{ ...cardBox, gap: 10 }}>

        {/* Idle: the honest pitch + the real file picker. */}
        {phase === 'idle' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('modal.cv.intro')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => inputRef.current?.click()}
                style={{ ...ghostBtn, borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)',
                  background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', color: 'var(--color-primary)', fontWeight: 600 }}>
                <FileUp size={14} /> {t('modal.cv.choose')}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cv.hint')}</span>
            </div>
          </>
        )}

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
              <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>{t('modal.cv.checkNotice')}</div>
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

        {/* The real input: labelled for assistive tech, kept out of the tab order and
            out of sight — the visible button is what drives it (§6). */}
        <input ref={inputRef} type="file" accept={CV_ACCEPT_MIME} onChange={handleChange}
          aria-label={t('modal.cv.choose')} tabIndex={-1}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0 }} />
      </div>
    </div>
  )
}
