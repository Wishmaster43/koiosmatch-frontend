import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle, X, Edit2, Save } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface RejectionReason { id?: Id; name?: string; label?: string }
// Moved from RejectionBlock (now deleted) — the shape the confirm submits.
export interface RejectPayload { reason_id: string; note: string; reason_label: string }

// Overlay/panel frame mirrors DetachReasonModal (§ house rule) — wider (520 vs
// 420) because this one also holds a rich-text editor.
const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }
const panel: CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 71,
  width: 520, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 20,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '86vh', overflowY: 'auto',
}
const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' } as const
// The collapsed read-only note card (mirrors ProfileTab's profile-text block).
const noteBlock = { borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '8px 10px' } as const

interface Props {
  application: ApplicationDetail
  onCancel: () => void
  onConfirm: (payload: RejectPayload) => void
  submitting?: boolean
}

/**
 * RejectionModal — the reject FORM, moved into the DetachReasonModal frame
 * (Danny 25-07): a footer button + confirm modal instead of a permanent block
 * at the bottom of the Sollicitatie tab. Content and behaviour are unchanged
 * from the old RejectionBlock: AI advice, a reason (searchable, tenant-lookup
 * CreatableSelect — S8) + an optional rich-text toelichting (S9), then confirm.
 * The rejection MESSAGE (channel + template) is sent by a workflow that fires
 * on rejection — so no channel picker/preview here.
 */
export default function RejectionModal({ application: a, onCancel, onConfirm, submitting }: Props) {
  const { t } = useTranslation(['applications', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onCancel)
  const aliveRef = useRef(true)
  const [reasons, setReasons] = useState<RejectionReason[]>([])
  const [reasonId, setReasonId] = useState('')
  // `note` is the confirmed value submitted on Afwijzen; `draftNote` is the
  // in-progress edit, only committed to `note` on Save (mirrors the old
  // RejectionBlock's summary/cancel-to-source pattern).
  const [note, setNote] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteExpanded, setNoteExpanded] = useState(false)

  const startNoteEdit  = () => { setDraftNote(note); setNoteEditing(true) }
  const saveNote       = () => { setNote(draftNote); setNoteEditing(false) }
  const cancelNoteEdit = () => setNoteEditing(false)

  // Load the rejection reasons; empty on failure, never demo data. Guarded by
  // an alive flag (§9) so a fast close cannot set state on an unmounted modal.
  useEffect(() => {
    aliveRef.current = true
    api.get('/candidate-rejection-reasons').then(r => {
      if (aliveRef.current) setReasons(unwrapList<RejectionReason>(r).rows)
    }).catch(() => { if (aliveRef.current) setReasons([]) })
    return () => { aliveRef.current = false }
  }, [])

  const reason = reasons.find(r => String(r.id) === String(reasonId))
  const reasonLabel = reason?.name ?? reason?.label ?? ''

  const submit = () => {
    if (!reasonId || submitting) return
    onConfirm({ reason_id: reasonId, note, reason_label: reasonLabel })
  }

  return (
    <>
      <div style={overlay} onClick={onCancel} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('rejection.modalTitle')} tabIndex={-1}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><XCircle size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('rejection.modalTitle')}</span>
          <button onClick={onCancel} aria-label={t('common:close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                // A distinct label (not the generic common:edit) — two icon-only
                // buttons both announced as "Edit" is a real a11y ambiguity.
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
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)',
            borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            {t('common:cancel')}
          </button>
          <button onClick={submit} disabled={!reasonId || submitting}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
              background: 'var(--color-danger)', color: '#fff', cursor: (!reasonId || submitting) ? 'not-allowed' : 'pointer',
              opacity: (!reasonId || submitting) ? 0.6 : 1 }}>
            {t('rejection.confirm')}
          </button>
        </div>
      </div>
    </>
  )
}
