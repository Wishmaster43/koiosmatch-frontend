/**
 * OutreachTargetNotePopout — BELLIJST-NOTE-POPOUT-1 (Danny 14-08, looking at the
 * call-list target's note editor: "dit moet zeker een pop-out kunnen worden op
 * een popup"). This field is a NOTE, not a description field, so it renders the
 * exact same editor stack TargetNoteField already composes on the row —
 * RichTextEditor (assist off) + RichTextAssistBar (mic only) + NoteAssistSection
 * (Verbeteren/Samenvatten/Actiepunten) — never popout/TextPopoutEditor's
 * "Genereer met Koios" composition, which is for a description-style field
 * (§11: mirror the SOURCE field's own composition, never invent a third shape).
 *
 * Same recipe as CustomerDepartmentTextPopout one level deeper: `id` is the
 * COMPOSITE `<campaignId>:<targetId>` (outreachTargetPopoutId, lib/secondScreen)
 * — no standalone `GET /outreach-targets/{id}` exists, so this window loads the
 * campaign detail and finds its own row (useOutreachTargetTextLite).
 *
 * Persists through the SAME `PATCH /outreach-targets/{id}` route TargetsTab's
 * own onSetNote uses (patchTargetNote → updateTarget), then tells the opener via
 * the established useTextPopoutDraft/useTextPopoutSync channel — TargetNoteField's
 * own useTextPopoutHost picks it up as `onSaved`, so the row behind this window
 * never keeps showing the stale note (no second channel — the one BroadcastChannel
 * TEKST-POPOUT-1 already wires does the talking-back).
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import PopoutShell from '@/pages/popout/PopoutShell'
import PopoutSaveFooter from '@/pages/popout/PopoutSaveFooter'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextAssistBar from '@/components/ui/RichTextAssistBar'
import NoteAssistSection from '@/components/drawer/tabs/notes/NoteAssistSection'
import { useTextPopoutDraft } from '@/pages/popout/hooks/useTextPopoutDraft'
import { useOutreachTargetTextLite, patchTargetNote } from '../hooks/useOutreachTargetTextPopout'
import { textPopoutTopic, parseOutreachTargetPopoutId } from '@/lib/secondScreen'

export default function OutreachTargetNotePopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation(['outreach', 'common'])
  const parsed = parseOutreachTargetPopoutId(id)
  const { target, loading, error, reload } = useOutreachTargetTextLite(parsed?.campaignId, parsed?.targetId)

  // Persist through the standalone PATCH; `revert` runs on a rejected write so
  // neither window keeps claiming the note was saved.
  const persist = useCallback((html: string, revert: () => void) => {
    if (!parsed) return Promise.resolve(false)
    return patchTargetNote(parsed.targetId, html, t, revert)
  }, [parsed, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('outreachTarget', id ?? '', 'targetNote'),
    storedValue: target?.note,
    onSave: persist,
  })

  // Window title — "Notitie — <candidate>" while this popout is open; restored
  // on unmount so a reused window slot never keeps a stale title.
  useEffect(() => {
    if (!target) return
    const previous = document.title
    document.title = t('outreach:drawer.note.windowTitle', { name: target.candidateName })
    return () => { document.title = previous }
  }, [target, t])

  // A malformed/legacy id (no campaign+target pair) is an honest "unknown
  // record" state, never a silent wrong fetch (§3).
  if (!parsed) {
    return (
      <PopoutShell
        loading={false} error onRetry={reload}
        loadingLabel="" errorLabel={t('common:popout.loadError')} retryLabel={t('common:error.retry')}
        name="" initials="" subtitle=""
      >
        {null}
      </PopoutShell>
    )
  }

  return (
    <PopoutShell
      loading={loading} error={error || !target} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('common:popout.loadError')} retryLabel={t('common:error.retry')}
      name={target?.candidateName ?? ''} initials="" subtitle={t('outreach:drawer.note.title')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
        {/* Same rich-text + mic composition TargetNoteField uses — its own Koios
            buttons live in NoteAssistSection below, not the editor's assist prop. */}
        <RichTextEditor value={text ?? ''} onChange={change} assist={false}
          toolbarExtra={<RichTextAssistBar value={text ?? ''} onChange={change} modes={[]} />}
          fill minHeight={160} />
        <NoteAssistSection body={text ?? ''} onApply={change} />
        <PopoutSaveFooter dirty={dirty} onSave={save} />
      </div>
    </PopoutShell>
  )
}
