import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle, Edit2, Save, X } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface RejectionReason { id?: Id; name?: string; label?: string }
export interface RejectPayload { reason_id: string; note: string; reason_label: string }

const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' } as const
// The collapsed read-only note's card (mirrors ProfileTab's profile-text block).
const noteBlock = { borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '8px 10px' } as const

/**
 * RejectionBlock — reject an application: AI advice (a hard-criterion failure is
 * the only auto-reject case), a reason (searchable, tenant-lookup CreatableSelect
 * — S8) + an optional rich-text toelichting (S9), then a confirm. The rejection
 * MESSAGE (channel + template) is sent by a workflow that fires on rejection —
 * so no channel picker / preview here.
 *
 * The toelichting (Danny 21-07) collapses by default — read-only SafeHtml (or a
 * calm placeholder when empty), a pencil opens the rich-text editor — exactly
 * mirroring the candidate profile-text pattern (ProfileTab's summary block).
 * Save/cancel here only confirm or discard the LOCAL draft (there is no
 * per-field PATCH — reason + note are submitted together on "Afwijzen").
 */
export default function RejectionBlock({ application: a, onReject }: { application: ApplicationDetail; onReject?: (id: Id | undefined, payload: RejectPayload) => void }) {
  const { t } = useTranslation(['applications', 'common'])
  const [reasons, setReasons]   = useState<RejectionReason[]>([])
  const [reasonId, setReasonId] = useState('')
  // `note` is the confirmed value submitted on Afwijzen; `draftNote` is the
  // in-progress edit, only committed to `note` on Save (mirrors ProfileTab's
  // summary/cancel-to-source pattern, with the draft standing in for `c.summary`
  // since there is no server value to revert to before the first submit).
  const [note, setNote]         = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const startNoteEdit  = () => { setDraftNote(note); setNoteEditing(true) }
  const saveNote       = () => { setNote(draftNote); setNoteEditing(false) }
  const cancelNoteEdit = () => setNoteEditing(false)

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

      {/* Note — collapsed by default (profile-text pattern, §3A/§4): read-only
          SafeHtml (or a calm placeholder) until the pencil opens the shared
          rich-text editor (S9, house rule), never a bare textarea. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('rejection.note')}</span>
          {noteEditing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={saveNote} title={t('common:save')} aria-label={t('common:save')}
                style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
              <button onClick={cancelNoteEdit} title={t('common:cancel')} aria-label={t('common:cancel')}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
            </div>
          ) : (
            // A distinct label (not the generic common:edit) — this tab already has
            // a Details-block pencil sharing that label, and two icon-only buttons
            // both announced as "Edit" is a real a11y ambiguity, not just a test nuisance.
            <button onClick={startNoteEdit} title={t('rejection.editNote')} aria-label={t('rejection.editNote')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Edit2 size={13} /></button>
          )}
        </div>
        {noteEditing ? (
          <RichTextEditor value={draftNote} onChange={setDraftNote}
            expanded={noteExpanded} onToggleExpand={() => setNoteExpanded(v => !v)} />
        ) : note ? (
          <div style={noteBlock}><SafeHtml html={note} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} /></div>
        ) : (
          <div style={{ ...noteBlock, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('rejection.notePlaceholder')}</div>
        )}
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
