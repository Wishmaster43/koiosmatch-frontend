/**
 * CollapsibleRichText — a collapsed ghost affordance that only reveals a
 * RichTextEditor once clicked; never auto-opens. Extracted (Danny 02-08: "bij
 * popup Nieuwe kandidaat, nieuwe klant, nieuwe locatie en afdeling moet altijd
 * een tekstveld aanwezig zijn zoals we hebben bij + match") from the candidate
 * match form's RemarksSection so every entity's optional prose field —
 * candidate profile text, customer company text, location/department
 * description — gets the exact same low-height, always-present shape instead
 * of five near-identical copies. Both properties matter: the field is ALWAYS
 * there, but it costs almost no height until someone wants it. Cancel (✕)
 * reverts to the text as it was when the editor opened and collapses again,
 * mirroring the house pencil ↔ ✕ idiom (§3A). Pure presentational, all state
 * via props — lives in components/ui (not an entity folder, §2) because it is
 * shared by candidates AND customers.
 */
import { useRef } from 'react'
import { Pencil, X, ExternalLink } from 'lucide-react'
import type { TFunction } from 'i18next'
import RichTextEditor from './RichTextEditor'
import type { RichTextAssistMode } from './richtext/richTextAssistApi'

export interface CollapsibleRichTextProps {
  t: TFunction
  value: string
  onChange: (v: string) => void
  expanded: boolean
  setExpanded: (fn: (v: boolean) => boolean) => void
  editing: boolean
  setEditing: (v: boolean) => void
  /** Already-translated hint shown in the collapsed ghost when there is no text yet. */
  placeholder: string
  /**
   * DEFECT FIX (Danny 02-08, discovered running AddLocationModal's tests): several
   * callers' footer submit button is itself labelled with the SAME generic word as
   * the shared `common:add` placeholder (Location/Department: subModal.create ===
   * "Toevoegen"/"Add") — two buttons in one modal with an identical accessible name
   * is a real a11y ambiguity (a screen-reader/keyboard user cannot tell them apart),
   * not just a test nuisance. Optional so every existing caller (candidate profile
   * text, customer Bedrijfstekst) keeps its current behaviour untouched; a caller
   * with a colliding footer label passes its own card heading instead.
   */
  ariaLabel?: string
  /**
   * ACTIONS-SCOPE-DEFAULT-FLIP (Danny 09-08): passthrough to RichTextEditor's own
   * `assistModes`. Most CollapsibleRichText callers are DESCRIPTIONS (department,
   * location, company, candidate profile, opportunity) — leave this unset and they
   * inherit RichTextAssistBar's shared default (improve+summarize, no actiepunten).
   * The two callers that read as a CONVERSATION (+Match's Opmerkingen, the vacancy
   * attachments note) pass `['improve', 'summarize', 'actions']` explicitly.
   */
  assistModes?: RichTextAssistMode[]
  /**
   * MATCH-REMARKS-POPOUT (batch 5, P34): optional second-screen affordance,
   * mirroring ProfileTab's own ExternalLink icon (openSummaryPopout). Omitted
   * by every existing caller (customer/location/department text) so this stays
   * fully backward compatible — only a caller that wires useTextPopoutHost
   * passes it.
   */
  onPopout?: () => void
}

export default function CollapsibleRichText({
  t, value, onChange, expanded, setExpanded, editing, setEditing, placeholder, ariaLabel, assistModes, onPopout,
}: CollapsibleRichTextProps) {
  // Snapshot at open, so ✕ can revert unsaved edits (form-local, no server call).
  const openedWithRef = useRef('')

  const open = () => { openedWithRef.current = value; setEditing(true) }
  const cancel = () => { onChange(openedWithRef.current); setEditing(false) }

  return editing ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Cancel above the block, house in-place-edit idiom (§3A). Pop-out sits
          left of cancel, same icon+footprint as ProfileTab's own second-screen
          button — only rendered when the caller wired one. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        {onPopout && (
          <button type="button" onClick={onPopout} title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}
            style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, cursor: 'pointer', background: 'var(--bg)', color: 'var(--text-muted)',
              border: '1px solid var(--border)' }}>
            <ExternalLink size={13} />
          </button>
        )}
        <button type="button" onClick={cancel} title={t('common:cancel')} aria-label={t('common:cancel')}
          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, cursor: 'pointer', background: 'var(--bg)', color: 'var(--text-muted)',
            border: '1px solid var(--border)' }}>
          <X size={13} />
        </button>
      </div>
      {/* Rich-text block (house rule, CLAUDE.md §3A/§4), not a bare textarea —
          stored/POSTed as sanitised HTML. `assistModes` forwards straight through
          to RichTextEditor; unset means "inherit the shared default" (see the
          prop's own doc comment above). */}
      <RichTextEditor value={value} onChange={onChange}
        expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} assistModes={assistModes} />
    </div>
  ) : (
    // Collapsed ghost affordance (dashed border) — shows a one-line preview when
    // text exists; clicking reveals the editor; never opens on its own.
    <button type="button" onClick={open} aria-label={ariaLabel}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left',
        padding: '10px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--bg)',
        cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || placeholder : placeholder}
      </span>
      <Pencil size={13} style={{ flexShrink: 0 }} />
    </button>
  )
}
