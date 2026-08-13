/**
 * PasteCvCard — PASTE-CV-1 (13-08): "plak een cv" alongside the file upload,
 * hitting the SAME /candidates/parse-cv route+poll (raw_text body instead of a
 * file) and the SAME buildCvPrefill mapping — no second proposal pipeline.
 * Under-length text shows a calm hint and fires no request; the real minimum
 * is enforced server-side too (§7, client check is UX only).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardPaste, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import { CV_TEXT_MIN_CHARS, CV_TEXT_MAX_CHARS } from './useCvParse'
import type { CvPhase } from './useCvParse'
import type { CvPrefillResult } from './cvPrefill'
import { cardHead, cardBox } from './fields'

interface PasteCvCardProps {
  phase: CvPhase
  errorKey: string | null
  summary: CvPrefillResult | null
  onSubmit: (text: string) => void
  onReset: () => void
}

const ghostBtn = {
  height: BTN_H, padding: '0 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'none', color: 'var(--text)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
} as const

export default function PasteCvCard({ phase, errorKey, summary, onSubmit, onReset }: PasteCvCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const [text, setText] = useState('')
  const busy = phase === 'uploading' || phase === 'processing'
  const tooShort = text.trim().length > 0 && text.trim().length < CV_TEXT_MIN_CHARS
  const canSubmit = text.trim().length >= CV_TEXT_MIN_CHARS && text.trim().length <= CV_TEXT_MAX_CHARS

  // Reset local text after a full reset (retry) so a stale paste never re-submits.
  const handleReset = () => { setText(''); onReset() }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{t('modal.cvPaste.title')}</div>
      <div style={{ ...cardBox, gap: 8, padding: 10 }}>

        {phase === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <ClipboardPaste size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 6 }} />
              <textarea value={text} onChange={e => setText(e.target.value)}
                aria-label={t('modal.cvPaste.title')} placeholder={t('modal.cvPaste.placeholder')}
                maxLength={CV_TEXT_MAX_CHARS}
                style={{ flex: 1, minHeight: 64, resize: 'vertical', fontSize: 12, color: 'var(--text)',
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" disabled={!canSubmit} onClick={() => onSubmit(text)}
                style={{ ...ghostBtn, borderColor: 'color-mix(in srgb, var(--color-primary) 45%, transparent)',
                  background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', color: 'var(--color-primary-text)',
                  fontWeight: 600, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                {t('modal.cvPaste.submit')}
              </button>
              {/* Calm hint, no request — the recruiter is still typing/pasting. */}
              {tooShort && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('modal.cvPaste.tooShort', { min: CV_TEXT_MIN_CHARS })}</span>}
            </div>
          </div>
        )}

        {busy && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="animate-spin" />
            {phase === 'uploading' ? t('modal.cv.uploading') : t('modal.cv.reading')}
            <button type="button" onClick={handleReset} style={{ ...ghostBtn, marginLeft: 'auto' }}>{t('common:cancel')}</button>
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
            <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t(errorKey ?? 'modal.cv.error.generic')}</span>
            <button type="button" onClick={handleReset} style={{ ...ghostBtn, marginLeft: 'auto' }}>
              <RotateCcw size={13} /> {t('modal.cv.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
