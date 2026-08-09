/**
 * OpportunityDescriptionBlock — the "Kanstekst" prose block on the Details tab
 * (OPP-DESCRIPTION-1, CMBE golf 2a/2b): own house pencil → save (diskette) /
 * cancel (✕), a RichTextEditor while editing, SafeHtml display otherwise —
 * mirrors the candidate profile-text / customer Bedrijfstekst idiom (§3A
 * "every free-text field is a rich-text block", CLAUDE.md §4). Built locally
 * in opportunities/drawer rather than importing another entity's drawer
 * internals (§2) — the same small per-entity pattern already exists as
 * customers/drawer/EditableRichTextField and matches/drawer/MatchTextBlock.
 *
 * ACTIONS-SCOPE-1 (Danny 09-08): `assistModes` is pinned to Verbeteren/
 * Samenvatten only — the "Kanstekst" is a description of the opportunity, not
 * a conversation, so "Actiepunten" (which belongs to a NOTE yielding follow-up
 * tasks, §3A) does not apply here.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'

interface OpportunityDescriptionBlockProps {
  // Current sanitised-HTML value (empty string = nothing filled in yet).
  value: string
  // Persist the new HTML — the caller wires this to onUpdate (PATCH /opportunities/{id}).
  onSave: (html: string) => void
}

export default function OpportunityDescriptionBlock({ value, onSave }: OpportunityDescriptionBlockProps) {
  const { t } = useTranslation('opportunities')
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(value)

  // Enter edit mode with a fresh draft (in case `value` changed since last edit).
  const start  = () => { setDraft(value); setEditing(true) }
  const save   = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('details.groups.description')}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={t('common:save')} aria-label={t('common:save')}
              style={{ ...iconBtn, background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }}>
              <Save size={13} />
            </button>
            <button onClick={cancel} title={t('common:cancel')} aria-label={t('common:cancel')}
              style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={start} title={t('common:edit')} aria-label={t('common:edit')}
            style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <Edit2 size={13} />
          </button>
        )}
      </div>
      {editing
        ? <RichTextEditor value={draft} onChange={setDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)}
            assistModes={['improve', 'summarize']} />
        : (value
            ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
                <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              </div>
            // Empty state renders italic + muted (§4: italic reserved for placeholder text).
            : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {t('richText.empty')}
              </div>)}
    </div>
  )
}
