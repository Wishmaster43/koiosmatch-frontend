/**
 * OpportunityDescriptionBlock — the "Kanstekst" pencil → save/cancel cycle, the
 * SafeHtml read display, and the italic-muted empty state (§4: italic reserved
 * for placeholder text; house rule Danny 2026-07-14: every prose field is a
 * rich-text block with its own edit dance) — mirrors
 * customers/drawer/EditableRichTextField (the component). Built locally
 * in opportunities/drawer rather than importing another entity's drawer
 * internals (§2) — the same small per-entity pattern already exists as
 * customers/drawer/EditableRichTextField and matches/drawer/MatchTextBlock.
 *
 * The "Kanstekst" is a description of the opportunity, not a conversation, so
 * it never opts into "Actiepunten" — it rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed.
 *
 * TEKST-POPOUT-1 (Danny 21-08): the second-screen affordance, mirrored 1:1
 * from matches/drawer/MatchTextBlock.tsx — a matchId-style `opportunityId`
 * prop feeds useTextPopoutHost, so drawer and popped-out window share one
 * draft. `shown` is what the read-only branch displays: it follows the
 * `value` prop, but a save from the POPPED-OUT window updates it immediately
 * (that window PATCHes straight through useOpportunityTextPopout, bypassing
 * this drawer's own onSave/onUpdate entirely, so the prop only refreshes on
 * the next fetch). Unlike MatchTextBlock there is no `loading` gate on the
 * sync effect: this block has no lazy per-tab fetch of its own — `value` is
 * always the already-loaded opportunity record.
 */
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
import type { Id } from '@/types/common'

interface OpportunityDescriptionBlockProps {
  // For the second-screen popout (TEKST-POPOUT-1) — the opportunity this text belongs to.
  opportunityId?: Id
  // Current sanitised-HTML value (empty string = nothing filled in yet).
  value: string
  // Persist the new HTML — the caller wires this to onUpdate (PATCH /opportunities/{id}).
  onSave: (html: string) => void
}

export default function OpportunityDescriptionBlock({ opportunityId, value, onSave }: OpportunityDescriptionBlockProps) {
  const { t } = useTranslation('opportunities')
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(value)
  // What the read-only branch shows — see the file header for why this is
  // tracked separately from the `value` prop.
  const [shown, setShown] = useState(value)
  useEffect(() => { setShown(value); setDraft(value) }, [value])

  // TEKST-POPOUT-1: one shared draft between drawer and popped-out window
  // (mirrors MatchTextBlock).
  const popout = useTextPopoutHost({
    entity: 'opportunity', id: opportunityId != null ? String(opportunityId) : '', field: 'description',
    value: draft, dirty: editing && draft !== shown,
    onDraft: (html: string) => { setDraft(html); setEditing(true) },
    onSaved: (html: string) => { setDraft(html); setShown(html); setEditing(false) },
  })
  const changeDraft = (html: string) => { setDraft(html); popout.publishDraft(html) }
  const openPopout = () => { if (opportunityId == null) return; setEditing(true); popout.open() }

  // Enter edit mode with a fresh draft (in case `value` changed since last edit).
  const start  = () => { setDraft(shown); setEditing(true) }
  const save   = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(shown); setEditing(false) }

  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <GroupLabel>{t('details.groups.description')}</GroupLabel>
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
          <div style={{ display: 'flex', gap: 4 }}>
            {opportunityId != null && (
              <Button variant="secondary" iconOnly size="sm" onClick={openPopout}
                title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}>
                <ExternalLink size={13} />
              </Button>
            )}
            <Button variant="secondary" iconOnly size="sm" onClick={start} title={t('common:edit')} aria-label={t('common:edit')}>
              <Edit2 size={13} />
            </Button>
          </div>
        )}
      </div>
      {editing
        ? <RichTextEditor value={draft} onChange={changeDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} />
        : (shown
            ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
                <SafeHtml html={shown} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              </div>
            // Empty state renders italic + muted (§4: italic reserved for placeholder text).
            : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {t('richText.empty')}
              </div>)}
    </div>
  )
}
