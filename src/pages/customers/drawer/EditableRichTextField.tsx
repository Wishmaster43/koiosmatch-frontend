/**
 * EditableRichTextField — one rich-text prose block with its OWN in-place edit
 * (pencil → save/cancel), mirroring the candidate profile-text pattern
 * (candidates/drawer/ProfileTab.tsx): SafeHtml display (sanitised HTML, italic
 * muted placeholder when empty), RichTextEditor + expand/collapse + a clear
 * button while editing. Generic on purpose — the customer's Teksten section
 * (Beschrijving/Wervingsproblemen) and the department's Omschrijving both reuse
 * this ONE component instead of forking the pencil/save/cancel dance per field
 * (Danny 2026-07-14; house rule: every multi-line prose field is a rich-text
 * block, never a bare textarea).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2 } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'

interface Props {
  // Section label shown above the block (e.g. "Beschrijving").
  label: string
  // Current sanitised-HTML value (empty string = nothing filled in yet).
  value: string
  // Persist the new HTML — the caller wires this to its own onUpdate/PATCH flow.
  onSave: (html: string) => void
}

export default function EditableRichTextField({ label, value, onSave }: Props) {
  const { t } = useTranslation('common')
  const [editing,  setEditing]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft,    setDraft]    = useState(value)

  // Enter edit mode with a fresh draft (in case `value` changed since last edit).
  const start  = () => { setDraft(value); setEditing(true) }
  const save   = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Clear the text (edit mode only) — same spot as the candidate profile text. */}
          {editing && (
            <button onClick={() => setDraft('')} title={t('clear')} aria-label={t('clear')}
              style={{ ...iconBtn, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--border)' }}>
              <Trash2 size={13} />
            </button>
          )}
          {editing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={save} title={t('save')} aria-label={t('save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
              <button onClick={cancel} title={t('cancel')} aria-label={t('cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
            </div>
          ) : (
            <button onClick={start} title={t('edit')} aria-label={t('edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
          )}
        </div>
      </div>
      {editing
        ? <RichTextEditor value={draft} onChange={setDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} />
        : (value
            ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
                <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              </div>
            // Empty state renders italic + muted (§4: italic reserved for placeholder text).
            : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {t('customers:richText.empty')}
              </div>)}
    </div>
  )
}
