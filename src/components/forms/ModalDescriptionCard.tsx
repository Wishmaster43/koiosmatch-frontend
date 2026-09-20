/**
 * ModalDescriptionCard — shared description field for create modals:
 * the "Omschrijving"/"Kanstekst" card with CollapsibleRichText.
 * Pure presentational — the text VALUE and its onChange come from the parent
 * form state; the expand/editing UI state is purely local (nothing outside
 * this card ever reads it).
 *
 * COLLAPSIBLE-TEXT-1 (02-08 round 2): the always-open editor became the shared
 * collapsed-ghost block (same shape as +Match's Opmerkingen). Optional Koios
 * assist modes and header actions (e.g. NoteKoiosModeToggle) can be injected.
 *
 * Lives in components/forms so both customers and opportunities can import it
 * directly without crossing an entity's page boundary. Mirrors
 * their common collapsed-ghost pattern. Born in the location/department modals
 * (Danny 02-08: "location and department should also get a description
 * field") and extracted at the ~400-line split trigger (§0.3); the text VALUE and
 * its onChange come from the parent's form state, only expand/editing state is local.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import type { RichTextAssistMode } from '@/components/ui/richtext/richTextAssistApi'

interface ModalDescriptionCardProps {
  /** The current description text value. */
  value: string
  /** Called when the text changes. */
  onChange: (v: string) => void
  /** Card heading label (e.g. t('locations.detail.description')). */
  label: string
  /**
   * Accessible name of the editor, resolved by the consumer. ARIA-LABEL-1: the modal's
   * own footer button is ALSO labelled subModal.create ("Toevoegen"/"Add", the same word
   * as the generic common:add placeholder), so the card's own heading is passed here and
   * two controls never share one accessible name — never a fallback to the placeholder.
   */
  ariaLabel: string
  /** Placeholder of the collapsed ghost, resolved by the consumer (rule C: no key in here). */
  placeholder: string
  /**
   * Optional node rendered in the card header. The opportunity card passes
   * NoteKoiosModeToggle — Danny 14-08 ("de schakelaar"): the same Wizard/Auto switch the
   * task modal carries, one shared per-user preference, mirrored, never a forked copy.
   */
  headerAction?: React.ReactNode
  /** Optional assist modes for Koios (e.g. ['improve', 'summarize', 'actions']). */
  assistModes?: RichTextAssistMode[]
}

// Shared description card for modals — value/onChange from parent, expand/edit state is local.
export default function ModalDescriptionCard({
  value, onChange, label, ariaLabel, placeholder, headerAction, assistModes,
}: ModalDescriptionCardProps) {
  const { t } = useTranslation(['common'])
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)


  return (
    <div>
      {headerAction ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={cardHead}>{label}</div>
          {headerAction}
        </div>
      ) : (
        <div style={cardHead}>{label}</div>
      )}
      <div style={cardBox}>
        <CollapsibleRichText t={t} value={value} onChange={onChange}
          expanded={expanded} setExpanded={setExpanded}
          editing={editing} setEditing={setEditing}
          placeholder={placeholder} ariaLabel={ariaLabel}
          {...(assistModes ? { assistModes } : {})} />
      </div>
    </div>
  )
}
