import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface RejectionReason { id?: Id; name?: string; label?: string }
export interface RejectPayload { reason_id: string; note: string; reason_label: string }

/**
 * RejectionBlock — reject an application: AI advice (a hard-criterion failure is
 * the only auto-reject case), a reason (searchable, tenant-lookup CreatableSelect
 * — S8) + an optional rich-text toelichting (S9), then a confirm. The rejection
 * MESSAGE (channel + template) is sent by a workflow that fires on rejection —
 * so no channel picker / preview here.
 */
export default function RejectionBlock({ application: a, onReject }: { application: ApplicationDetail; onReject?: (id: Id | undefined, payload: RejectPayload) => void }) {
  const { t } = useTranslation('applications')
  const [reasons, setReasons]   = useState<RejectionReason[]>([])
  const [reasonId, setReasonId] = useState('')
  const [note, setNote]         = useState('')
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load the rejection reasons; empty on failure, never demo data.
  useEffect(() => {
    api.get('/candidate-rejection-reasons').then(r => setReasons(unwrapList<RejectionReason>(r).rows)).catch(() => setReasons([]))
  }, [])

  // Already rejected → compact summary instead of the form. The toelichting/note
  // (S9 finding) is read-only here — there is no safe PATCH path for an already-
  // rejected application's note yet (re-running the reject endpoint would
  // re-notify the candidate), so this stays a display-only rich-text block.
  if (a.bucket === 'rejected') {
    const rejectionNote = a.rejection?.note as string | undefined
    return (
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <XCircle size={16} color="var(--color-danger)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('rejection.rejected')}</span>
        </div>
        {a.rejection?.reason_label && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{a.rejection.reason_label}</div>
        )}
        {rejectionNote && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('rejection.note')}</div>
            <SafeHtml html={rejectionNote} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
          </div>
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

      {/* Reason — searchable CreatableSelect (S8), allowCreate off: a rejection
          reason is a tenant lookup, picked never free-typed here. */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('rejection.reason')}</div>
        <CreatableSelect allowCreate={false} value={reasonId || null} onChange={setReasonId}
          placeholder={t('rejection.reasonPlaceholder')}
          options={reasons.map(r => ({ value: String(r.id ?? ''), label: r.name ?? r.label ?? '' }))} />
      </div>

      {/* Note — the shared rich-text block (S9, house rule §3A/§4), not a bare
          textarea; collapsed toolbar by default. */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('rejection.note')}</div>
        <RichTextEditor value={note} onChange={setNote}
          expanded={noteExpanded} onToggleExpand={() => setNoteExpanded(v => !v)} />
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
