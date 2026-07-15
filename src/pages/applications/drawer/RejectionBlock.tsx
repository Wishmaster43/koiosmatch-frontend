import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface RejectionReason { id?: Id; name?: string; label?: string }
export interface RejectPayload { reason_id: string; note: string; reason_label: string }

/**
 * RejectionBlock — reject an application: AI advice (a hard-criterion failure is
 * the only auto-reject case), a reason + optional note, then a confirm. The
 * rejection MESSAGE (channel + template) is sent by a workflow that fires on
 * rejection — so no channel picker / preview here.
 */
export default function RejectionBlock({ application: a, onReject }: { application: ApplicationDetail; onReject?: (id: Id | undefined, payload: RejectPayload) => void }) {
  const { t } = useTranslation('applications')
  const [reasons, setReasons]   = useState<RejectionReason[]>([])
  const [reasonId, setReasonId] = useState('')
  const [note, setNote]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load the rejection reasons; empty on failure, never demo data.
  useEffect(() => {
    api.get('/candidate-rejection-reasons').then(r => setReasons(unwrapList<RejectionReason>(r).rows)).catch(() => setReasons([]))
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

  const submit = () => {
    if (!reasonId || submitting) return
    setSubmitting(true)
    onReject?.(a.id, { reason_id: reasonId, note, reason_label: reasonLabel })
  }

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

      {/* Confirm */}
      <button onClick={submit} disabled={!reasonId || submitting}
        style={{ alignSelf: 'flex-start', height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, borderRadius: 8,
          border: '1px solid transparent', boxSizing: 'border-box', background: 'var(--color-danger)', color: '#fff',
          cursor: reasonId ? 'pointer' : 'not-allowed', opacity: reasonId ? 1 : 0.5 }}>
        {t('rejection.confirm')}
      </button>
    </div>
  )
}
