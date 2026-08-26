/**
 * LocationDescriptionCard — the "Omschrijving" card of AddLocationModal, same
 * convention as AddDepartmentModal's own (Danny 02-08, translated: "we should
 * also have a description for location and department" — verbatim: "bij
 * locatie en afdeling moeten we ook een beschrijving hebben"). Extracted (§0.3 — the
 * ~400-line split trigger, 2026-08-03); pure presentational, the text VALUE
 * and its `onChange` callback come from the parent's form state, but the
 * expand/editing UI state is purely local to this card (nothing outside it
 * ever reads that state).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface LocationDescriptionCardProps {
  value: string
  onChange: (v: string) => void
}

// Pure presentational description card (see the module doc above): value/onChange come from the parent form, expand/edit UI state is purely local.
export default function LocationDescriptionCard({ value, onChange }: LocationDescriptionCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  // COLLAPSIBLE-TEXT-1 (02-08 round 2): the always-open editor became the shared
  // collapsed-ghost block (same shape as +Match's Opmerkingen) — local state.
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <div>
      <div style={cardHead}>{t('locations.detail.description')}</div>
      <div style={cardBox}>
        {/* ARIA-LABEL-1: this modal's own footer button is ALSO labelled
            subModal.create ("Toevoegen"/"Add", same word as the generic
            common:add placeholder) — a distinct aria-label (the card's own
            heading) prevents two buttons sharing one accessible name. */}
        <CollapsibleRichText t={t} value={value} onChange={onChange}
          expanded={expanded} setExpanded={setExpanded}
          editing={editing} setEditing={setEditing}
          placeholder={t('common:add')} ariaLabel={t('locations.detail.description')} />
      </div>
    </div>
  )
}
