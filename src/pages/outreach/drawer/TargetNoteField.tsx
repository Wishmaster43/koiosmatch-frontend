/**
 * TargetNoteField — per-target free-text note (G30), now the SAME rich note as
 * the candidate drawer (Danny 14-08: "als je een notitie toevoegt dan moet deze
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
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import RichTextAssistBar from '@/components/ui/RichTextAssistBar'
import NoteAssistSection from '@/components/drawer/tabs/notes/NoteAssistSection'
import SafeHtml from '@/components/ui/SafeHtml'

export default function TargetNoteField({ note, onSave }: {
  note?: string | null
  // Persists the trimmed note via PATCH /outreach-targets/{id}; the caller
  // (TargetsTab, via useOutreachDetail.setTargetNote) owns the optimistic
  // update + revert-on-failure, so this component only awaits + surfaces errors.
  onSave: (note: string) => Promise<void>
}) {
  const { t } = useTranslation(['outreach', 'common'])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  // Enter edit mode with a fresh draft (in case `note` changed since last edit).
  const start = () => { setDraft(note ?? ''); setFailed(false); setEditing(true) }
  const cancel = () => { setDraft(note ?? ''); setFailed(false); setEditing(false) }
  const save = async () => {
    setSaving(true); setFailed(false)
    try { await onSave(draft.trim()); setEditing(false) }
    catch { setFailed(true) }
    finally { setSaving(false) }
  }

  const iconBtn = { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0 } as const

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {note
          ? <SafeHtml html={note} style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, minWidth: 0 }} />
          : <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', flex: 1 }}>{t('outreach:drawer.note.empty')}</span>}
        <button onClick={start} title={t('common:edit')} aria-label={t('common:edit')}
          style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Edit2 size={11} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Same rich-text + mic composition NoteFields uses (assist off on the
          editor itself — its own Koios buttons live in NoteAssistSection below). */}
      <RichTextEditor value={draft} onChange={setDraft} assist={false}
        toolbarExtra={<RichTextAssistBar value={draft} onChange={setDraft} modes={[]} />}
        minHeight={80} />
      {/* Koios AI assist — Verbeteren / Samenvatten / Actiepunten, byte-for-byte
          the candidate note's own block (§11 one source, no second copy). */}
      <NoteAssistSection body={draft} onApply={setDraft} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {failed && <span style={{ fontSize: 10, color: 'var(--color-danger)', flex: 1 }}>{t('outreach:drawer.note.saveFailed')}</span>}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button onClick={cancel} disabled={saving} title={t('common:cancel')} aria-label={t('common:cancel')}
            style={{ ...iconBtn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <X size={12} />
          </button>
          <button onClick={save} disabled={saving} title={t('common:save')} aria-label={t('common:save')}
            style={{ ...iconBtn, background: 'var(--color-primary)', border: 'none', color: 'var(--color-on-accent)', opacity: saving ? 0.6 : 1 }}>
            <Save size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
