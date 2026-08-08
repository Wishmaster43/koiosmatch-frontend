/**
 * TargetNoteField — per-target free-text note (G30). The field + max:2000
 * validation already exist on the backend as a PLAIN string
 * (UpdateOutreachTargetRequest: 'note' => 'sometimes|nullable|string|max:2000',
 * no HTML column) — so this is a plain textarea with the house field footprint
 * (mirrors DetachReasonModal's reason field), never the shared RichTextEditor
 * (§3A only mandates that for HTML-backed prose fields; this one is not).
 * In-place edit: pencil → textarea + save/cancel (§3A convention, mirrors
 * EditableRichTextField's Edit2/Save/X icon set), shown above the block, never
 * floating over the row.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'

const NOTE_MAX = 2000

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
          ? <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, minWidth: 0, whiteSpace: 'pre-wrap' }}>{note}</span>
          : <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', flex: 1 }}>{t('outreach:drawer.note.empty')}</span>}
        <button onClick={start} title={t('common:edit')} aria-label={t('common:edit')}
          style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Edit2 size={11} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <textarea autoFocus value={draft} maxLength={NOTE_MAX} disabled={saving} onChange={e => setDraft(e.target.value)} rows={2}
        placeholder={t('outreach:drawer.note.placeholder')}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 11, borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', resize: 'vertical', outline: 'none' }} />
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
