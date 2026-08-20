/**
 * TargetNoteField — per-target free-text note (G30), the SAME rich note as the
 * candidate drawer (Danny 14-08: "als je een notitie toevoegt dan moet deze
 * notitie wel hetzelfde zijn als nu een notitie, dus samenvatten verbeteren
 * actiepunten"). Reuses the shared building blocks a candidate note is built
 * from — `RichTextEditor` (assist off) + `RichTextAssistBar` (mic only, mirrors
 * `NoteFields`' own composition) + `NoteAssistSection` (Verbeteren / Samenvatten
 * / Actiepunten) — never a second hand-rolled assist block (§11). A bare
 * type/channel picker is NOT added here: the outreach target's note has no
 * backing type/channel column on the backend (`UpdateOutreachTargetRequest`
 * only validates `note`), so those two fields of the candidate note shape would
 * be a fake affordance (§3) — they simply have no lookup or column to persist
 * against on this entity.
 *
 * STORAGE FORM CHANGE: the backend field stays the same plain `note` string
 * (max:2000) at the same route/body shape (`updateTarget(id, { note })`), but
 * its VALUE is now HTML (Tiptap output) instead of plain text — the trade the
 * candidate note itself already makes. Read mode renders it through the shared
 * `SafeHtml` sanitizer, mirroring every other rich-text-backed field (§3A).
 *
 * In-place edit: pencil → editor + save/cancel (§3A convention), shown above
 * the block, never floating over the row.
 *
 * BELLIJST-NOTE-POPOUT-1 (Danny 14-08, looking at this exact editor: "dit moet
 * zeker een pop-out kunnen worden op een popup"): this is ONE field on ONE
 * record, so it gets the candidate PROFILE TEXT's second-screen treatment
 * (TEKST-POPOUT-1) — a plain PATCH of one column, never the notes-thread
 * pop-out (that one risks a duplicate note on an add-only window, which does
 * not apply here). `current` is the local source of truth for BOTH the read
 * and edit views (mirrors ProfileTab's `summary`), so a save landed by the
 * popped-out window shows up here immediately instead of waiting on a parent
 * re-render — and `onNoteSavedElsewhere` pushes that same save up to the
 * campaign-level state, so a collapsed-then-re-expanded row (this component
 * unmounts on collapse — see TargetsTab) never reads a stale prop either.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextAssistBar from '@/components/ui/RichTextAssistBar'
import NoteAssistSection from '@/components/drawer/tabs/notes/NoteAssistSection'
import SafeHtml from '@/components/ui/SafeHtml'
import Button from '@/components/ui/Button'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
import { outreachTargetPopoutId } from '@/lib/secondScreen'

export default function TargetNoteField({ note, onSave, targetId, campaignId, onNoteSavedElsewhere }: {
  note?: string | null
  // Persists the trimmed note via PATCH /outreach-targets/{id}; the caller
  // (TargetsTab, via useOutreachDetail.setTargetNote) owns the optimistic
  // update + revert-on-failure, so this component only awaits + surfaces errors.
  onSave: (note: string) => Promise<void>
  // Identity for the second-screen window — it has no drawer state of its own,
  // so it addresses this one target through the composite id (no standalone
  // GET /outreach-targets/{id} exists — see lib/secondScreen.ts).
  targetId: string
  campaignId: string
  // Tells the campaign-level state (useOutreachDetail.applyTargetNote) about a
  // note the pop-out window just persisted on its OWN PATCH — local state only,
  // never a second network call from here.
  onNoteSavedElsewhere?: (note: string) => void
}) {
  const { t } = useTranslation(['outreach', 'common'])
  const [editing, setEditing] = useState(false)
  // Local copy of the note — both the read view and the editor render THIS, not
  // the raw prop, so a save landed by the popped-out window is on screen the
  // instant it lands (mirrors ProfileTab's `summary`).
  const [current, setCurrent] = useState(note ?? '')
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  // Adopt the prop only when it genuinely changes (a reload, a save via the
  // row's own onSave) and no edit is in progress — never let a now-stale prop
  // clobber text the popped-out window already saved (mirrors ProfileTab's
  // lastRecordSummary guard).
  const lastProp = useRef(note ?? '')
  useEffect(() => {
    const next = note ?? ''
    if (next === lastProp.current) return
    lastProp.current = next
    setCurrent(next)
    if (!editing) setDraft(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note])

  // BELLIJST-NOTE-POPOUT-1: the SAME second-screen mechanism the candidate
  // profile text uses (§11 one source) — the shared window.open + named-window
  // + BroadcastChannel recipe, only the route (`outreachTarget`/`targetNote`)
  // differs. Both windows edit ONE draft: local edits publish, the popout's
  // save is adopted here AND pushed up to the campaign-level state so a
  // collapsed row never reads stale text on re-expand.
  const popout = useTextPopoutHost({
    entity: 'outreachTarget', id: outreachTargetPopoutId(campaignId, targetId), field: 'targetNote',
    value: draft, dirty: draft !== current,
    onDraft: html => { setDraft(html); setEditing(true) },
    onSaved: html => {
      setDraft(html); setCurrent(html); setEditing(false); lastProp.current = html
      onNoteSavedElsewhere?.(html)
    },
  })
  // Publish every local edit (typing, dictation, applied Koios suggestion) —
  // a no-op while no popout window is open (useTextPopoutSync's `post`).
  const changeDraft = (html: string) => { setDraft(html); popout.publishDraft(html) }
  // Open the second screen; editing starts here too, so the two windows show
  // one and the same draft and closing the popout can never strand unsaved text.
  const openPopout = () => { setEditing(true); popout.open() }

  // Enter edit mode with a fresh draft (in case `current` changed since last edit).
  const start = () => { setDraft(current); setFailed(false); setEditing(true) }
  const cancel = () => { setDraft(current); setFailed(false); setEditing(false) }
  const save = async () => {
    setSaving(true); setFailed(false)
    try {
      const trimmed = draft.trim()
      await onSave(trimmed)
      setCurrent(trimmed); setDraft(trimmed); lastProp.current = trimmed
      setEditing(false)
    }
    catch { setFailed(true) }
    finally { setSaving(false) }
  }

  // Pencil (read mode) or save/cancel (edit mode) — the second-screen icon sits
  // next to it in BOTH states, exactly like the candidate profile text block.
  const editControls = editing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <Button variant="secondary" iconOnly size="sm" onClick={cancel} disabled={saving} title={t('common:cancel')} aria-label={t('common:cancel')}>
        <X size={12} />
      </Button>
      <Button variant="primary" iconOnly size="sm" onClick={save} disabled={saving} title={t('common:save')} aria-label={t('common:save')}>
        <Save size={12} />
      </Button>
    </div>
  ) : (
    <Button variant="secondary" iconOnly size="sm" onClick={start} title={t('common:edit')} aria-label={t('common:edit')}>
      <Edit2 size={11} />
    </Button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {!editing && (current
          ? <SafeHtml html={current} style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, minWidth: 0 }} />
          : <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', flex: 1 }}>{t('outreach:drawer.note.empty')}</span>)}
        {editing && <div style={{ flex: 1 }} />}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {/* Second screen — same icon + footprint the candidate profile text
              uses for its own pop-out (§11: one mechanism). */}
          <Button variant="secondary" iconOnly size="sm" onClick={openPopout} title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}>
            <ExternalLink size={11} />
          </Button>
          {editControls}
        </div>
      </div>

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Same rich-text + mic composition NoteFields uses (assist off on the
              editor itself — its own Koios buttons live in NoteAssistSection below). */}
          <RichTextEditor value={draft} onChange={changeDraft} assist={false}
            toolbarExtra={<RichTextAssistBar value={draft} onChange={changeDraft} modes={[]} />}
            minHeight={80} />
          {/* Koios AI assist — Verbeteren / Samenvatten / Actiepunten, byte-for-byte
              the candidate note's own block (§11 one source, no second copy). */}
          <NoteAssistSection body={draft} onApply={changeDraft} />
          {failed && <span style={{ fontSize: 10, color: 'var(--color-danger-text)' }}>{t('outreach:drawer.note.saveFailed')}</span>}
        </div>
      )}
    </div>
  )
}
