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
 * The "Kanstekst" is a description of the opportunity, not a conversation, so
 * it never opts into "Actiepunten" — it rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import Button from '@/components/ui/Button'

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

  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('details.groups.description')}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button variant="primary" iconOnly size="sm" onClick={save} title={t('common:save')} aria-label={t('common:save')}>
              <Save size={13} />
            </Button>
            <Button variant="secondary" iconOnly size="sm" onClick={cancel} title={t('common:cancel')} aria-label={t('common:cancel')}>
              <X size={13} />
            </Button>
          </div>
        ) : (
          <Button variant="secondary" iconOnly size="sm" onClick={start} title={t('common:edit')} aria-label={t('common:edit')}>
            <Edit2 size={13} />
          </Button>
        )}
      </div>
      {editing
        ? <RichTextEditor value={draft} onChange={setDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} />
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
