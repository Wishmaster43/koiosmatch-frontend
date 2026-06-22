import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle } from 'lucide-react'
import api from '../../../lib/api'
import KoiosAiMark from '../../../components/ui/KoiosAiMark'
import { USE_MOCKS } from '../../../lib/mocks'
import { MOCK_REJECTION_REASONS } from '../data/mocks'

// Fill template tokens with the application's values.
const fillTokens = (tpl, vals) => (tpl ?? '')
  .replaceAll('{candidate}', vals.candidate)
  .replaceAll('{vacancy}', vals.vacancy)
  .replaceAll('{reason}', vals.reason)
  .replaceAll('{recruiter}', vals.recruiter)

/**
 * RejectionBlock — reject an application: AI advice (a hard-criterion failure is
 * the only auto-reject case), reason + note, channel + a live preview of the
 * generated message, then a confirm. Loads reasons + the rejection config
 * (default channel + per-reason templates) defensively.
 */
export default function RejectionBlock({ application: a, onReject }) {
  const { t } = useTranslation('applications')
  const [reasons, setReasons]   = useState([])
  const [config, setConfig]     = useState({ default_channel: 'email', templates: {} })
  const [reasonId, setReasonId] = useState('')
  const [note, setNote]         = useState('')
  const [channel, setChannel]   = useState('email')
  const [submitting, setSubmitting] = useState(false)

  // Load reasons + rejection config; fall back to mock reasons under USE_MOCKS.
  useEffect(() => {
    api.get('/candidate-rejection-reasons')
      .then(r => setReasons(r.data?.data ?? r.data ?? []))
      .catch(() => { if (USE_MOCKS) setReasons(MOCK_REJECTION_REASONS) })
    api.get('/settings/rejection')
      .then(r => { const c = r.data?.data ?? r.data; if (c?.default_channel) { setConfig(c); setChannel(c.default_channel) } })
      .catch(() => {})
  }, [])

  // Already rejected → compact summary instead of the form.
  if (a.bucket === 'rejected') {
    return (
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <XCircle size={16} color="var(--color-danger)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('rejection.rejected')}</span>
        </div>
        {a.rejection?.reason_label && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{a.rejection.reason_label}</div>
        )}
      </div>
    )
  }

  const reason = reasons.find(r => String(r.id) === String(reasonId))
  const reasonLabel = reason?.name ?? reason?.label ?? ''
  const tpl = config.templates?.[reasonId] ?? {}
  const vals = { candidate: a.candidateName, vacancy: a.vacancyTitle, reason: reasonLabel, recruiter: a.owner?.name ?? '' }
  const previewSubject = channel === 'email' ? fillTokens(tpl.email_subject, vals) : ''
  const previewBody    = channel === 'email' ? fillTokens(tpl.email_body, vals) : fillTokens(tpl.whatsapp_body, vals)
  const hasTemplate    = channel === 'email' ? Boolean(tpl.email_subject || tpl.email_body) : Boolean(tpl.whatsapp_body)

  const submit = () => {
    if (!reasonId || submitting) return
    setSubmitting(true)
    const message = channel === 'email' ? `${previewSubject}\n\n${previewBody}`.trim() : previewBody
    onReject?.(a.id, { reason_id: reasonId, note, channel, message, reason_label: reasonLabel })
  }

  const chanBtn = (value, label) => (
    <button onClick={() => setChannel(value)} style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 500,
      borderRadius: 8, cursor: 'pointer', boxSizing: 'border-box',
      border: `1px solid ${channel === value ? 'var(--color-primary)' : 'var(--border)'}`,
      background: channel === value ? 'var(--color-primary)' : 'var(--surface)', color: channel === value ? '#fff' : 'var(--text)' }}>
      {label}
    </button>
  )

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('rejection.title')}</div>

      {/* AI advice */}
      {a.ai?.advice === 'reject' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--color-primary-bg)', borderRadius: 8, padding: '8px 10px' }}>
          <KoiosAiMark size={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>{t('rejection.aiAdvice')}</div>
            {a.ai.advice_reason && <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{a.ai.advice_reason}</div>}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {a.ai.auto_reject_eligible ? t('rejection.aiAuto') : t('rejection.aiConfirm')}
            </div>
          </div>
        </div>
      )}

      {/* Reason */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('rejection.reason')}</div>
        <select value={reasonId} onChange={e => setReasonId(e.target.value)}
          style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--input-bg, var(--surface))', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}>
          <option value="">{t('rejection.reasonPlaceholder')}</option>
          {reasons.map(r => <option key={r.id} value={r.id}>{r.name ?? r.label}</option>)}
        </select>
      </div>

      {/* Note */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('rejection.note')}</div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder={t('rejection.notePlaceholder')}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--input-bg, var(--surface))', color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </div>

      {/* Channel */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('rejection.channel')}</div>
        <div style={{ display: 'flex', gap: 6 }}>{chanBtn('email', t('rejection.channelEmail'))}{chanBtn('whatsapp', t('rejection.channelWhatsapp'))}</div>
      </div>

      {/* Preview */}
      {reasonId && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('rejection.preview')}</div>
          {hasTemplate ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: '10px 12px' }}>
              {channel === 'email' && previewSubject && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{previewSubject}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{previewBody || '—'}</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('rejection.noTemplate')}</div>
          )}
        </div>
      )}

      {/* Confirm — same box-model + height as the channel buttons so the left edge lines up. */}
      <button onClick={submit} disabled={!reasonId || submitting}
        style={{ alignSelf: 'flex-start', height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, borderRadius: 8,
          border: '1px solid transparent', boxSizing: 'border-box', background: 'var(--color-danger)', color: '#fff',
          cursor: reasonId ? 'pointer' : 'not-allowed', opacity: reasonId ? 1 : 0.5 }}>
        {t('rejection.confirm')}
      </button>
    </div>
  )
}
