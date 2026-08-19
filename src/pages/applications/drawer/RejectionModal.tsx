import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle, X, Edit2, Save } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import { Caption } from '@/components/ui/typography'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

interface RejectionReason { id?: Id; name?: string; label?: string }
// Moved from RejectionBlock (now deleted) — the shape the confirm submits.
export interface RejectPayload { reason_id: string; note: string; reason_label: string }

// The collapsed read-only note card (mirrors ProfileTab's profile-text block).
const noteBlock = { borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '8px 10px' } as const

interface Props {
  application: ApplicationDetail
  onCancel: () => void
  onConfirm: (payload: RejectPayload) => void
  submitting?: boolean
  // APP-REJECTION-EDIT-1: 'correct' reuses this exact form to PATCH the reason/
  // note of an ALREADY rejected application (RejectionSummary's pencil) instead
  // of POSTing a brand-new reject — the caller's own onConfirm decides which
  // request fires, this component only changes its copy/prefill. Default 'reject'
  // keeps every existing caller (the footer button flow) unchanged.
  mode?: 'reject' | 'correct'
  // Correction-mode prefill — the existing reason/note being corrected. Ignored
  // in 'reject' mode (a fresh rejection always starts blank).
  initialReasonId?: string
  initialNote?: string
}

/**
 * RejectionModal — the reject FORM, moved into the DetachReasonModal frame
 * (Danny 25-07): a footer button + confirm modal instead of a permanent block
 * at the bottom of the Sollicitatie tab. Content and behaviour are unchanged
 * from the old RejectionBlock: AI advice, a reason (searchable, tenant-lookup
 * CreatableSelect — S8) + an optional rich-text toelichting (S9), then confirm.
 * The rejection MESSAGE (channel + template) is sent by a workflow that fires
 * on rejection — so no channel picker/preview here.
 *
 * APP-REJECTION-EDIT-1 (verified live: PATCH /applications/{id}/rejection
 * exists): `mode="correct"` reuses this same reason+note form, prefilled from
 * the existing rejection, to CORRECT it — the AI-advice block (a decision aid
 * for the ORIGINAL reject) is hidden, and the confirm button reads "save
 * correction" instead of "reject". The caller's onConfirm still receives the
 * exact same payload shape; only ITS request differs (PATCH vs POST).
 *
 * V-appdetail-4: the note already had an expand (`noteExpanded` +
 * RichTextEditor's `onToggleExpand`, unchanged here). It deliberately does NOT
 * get the second-screen pop-out: `note`/`draftNote` are un-persisted draft
 * state of this whole reject/correct form (reason + note commit together on
 * one submit) — there is no standalone PATCH for the note alone, so a pop-out
 * window would have nothing real to save through. Honest skip (§3, no fake
 * affordance) until rejections get their own draft-persistence route.
 */
export default function RejectionModal({ application: a, onCancel, onConfirm, submitting, mode = 'reject', initialReasonId, initialNote }: Props) {
  const { t } = useTranslation(['applications', 'common'])
  const aliveRef = useRef(true)
  const isCorrection = mode === 'correct'
  const [reasons, setReasons] = useState<RejectionReason[]>([])
  const [reasonId, setReasonId] = useState(initialReasonId ?? '')
  // `note` is the confirmed value submitted on Afwijzen; `draftNote` is the
  // in-progress edit, only committed to `note` on Save (mirrors the old
  // RejectionBlock's summary/cancel-to-source pattern).
  const [note, setNote] = useState(initialNote ?? '')
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
    // POPUP-SLEEP-1: shell swapped onto the shared FloatingPanel (draggable/
    // resizable, remembered position) — body/footer and flows unchanged.
    <FloatingPanel open onClose={onCancel} ariaLabel={isCorrection ? t('rejection.correctModalTitle') : t('rejection.modalTitle')}
      persistKey="application-rejection" width={520} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><XCircle size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {isCorrection ? t('rejection.correctModalTitle') : t('rejection.modalTitle')}
          </span>
        </span>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* AI advice — a decision aid for the ORIGINAL reject only; irrelevant
              once already rejected, so correction mode never shows it. */}
          {!isCorrection && a.ai?.advice === 'reject' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--color-primary-bg)', borderRadius: 8, padding: '8px 10px' }}>
              <KoiosAiMark size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)' }}>{t('rejection.aiAdvice')}</div>
                {a.ai.advice_reason && <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{a.ai.advice_reason}</div>}
                <Caption as="div" style={{ marginTop: 3 }}>
                  {a.ai.auto_reject_eligible ? t('rejection.aiAuto') : t('rejection.aiConfirm')}
                </Caption>
              </div>
            </div>
          )}

          {/* Reason — searchable CreatableSelect (S8), allowCreate off: a rejection
              reason is a tenant lookup, picked never free-typed here. */}
          <div>
            <Caption as="div" style={{ marginBottom: 5 }}>{t('rejection.reason')}</Caption>
            <CreatableSelect allowCreate={false} value={reasonId || null} onChange={setReasonId}
              placeholder={t('rejection.reasonPlaceholder')}
              options={reasons.map(r => ({ value: String(r.id ?? ''), label: r.name ?? r.label ?? '' }))} />
          </div>

          {/* Note — collapsed by default (profile-text pattern, §3A/§4): read-only
              SafeHtml (or a calm placeholder) until the pencil opens the shared
              rich-text editor (S9, house rule), never a bare textarea. */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <Caption>{t('rejection.note')}</Caption>
              {noteEditing ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button variant="primary" iconOnly size="sm" onClick={saveNote} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
                  <Button variant="secondary" iconOnly size="sm" onClick={cancelNoteEdit} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
                </div>
              ) : (
                // A distinct label (not the generic common:edit) — two icon-only
                // buttons both announced as "Edit" is a real a11y ambiguity.
                <Button variant="ghost" iconOnly size="sm" onClick={startNoteEdit} title={t('rejection.editNote')} aria-label={t('rejection.editNote')}><Edit2 size={13} /></Button>
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
          <Button variant="secondary" onClick={onCancel}>
            {t('common:cancel')}
          </Button>
          {/* Correction is a plain SAVE (primary), never the danger-red "Reject"
              button — no candidate-facing message goes out on this path. */}
          <Button variant={isCorrection ? 'primary' : 'danger'} onClick={submit} disabled={!reasonId || submitting}>
            {isCorrection ? t('rejection.saveCorrection') : t('rejection.confirm')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
