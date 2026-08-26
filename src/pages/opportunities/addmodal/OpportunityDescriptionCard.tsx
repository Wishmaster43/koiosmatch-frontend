/**
 * OpportunityDescriptionCard — the "Kanstekst" card of AddOpportunityModal
 * (OPP-DESCRIPTION-1, CMBE golf 2a/2b), same convention as +Match's own
 * Opmerkingen card and AddLocationModal's/AddDepartmentModal's description
 * cards: the shared collapsed-ghost `CollapsibleRichText` (never auto-open).
 * Pure presentational — the text VALUE and its `onChange` come from the
 * parent's form state; the expand/editing UI state is purely local (nothing
 * outside this card ever reads it).
 *
 * TASK-ASSIST-ACTIONS-1 (Danny 14-08, "ook bij nieuwe kans" — "also for a new
 * opportunity"): opts into the
 * third Koios assist mode via `assistModes={['improve', 'summarize', 'actions']}`
 * — mirrors AddTaskModal's DescriptionCard so Actiepunten (subtask/follow-up
 * suggestions) is available while drafting an opportunity's own text too.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import NoteKoiosModeToggle from '@/components/drawer/tabs/notes/NoteKoiosModeToggle'

interface OpportunityDescriptionCardProps {
  value: string
  onChange: (v: string) => void
}

// Description field for the opportunity create modal, rendered as the shared collapsed-ghost rich-text block rather than an always-open editor.
export default function OpportunityDescriptionCard({ value, onChange }: OpportunityDescriptionCardProps) {
  const { t } = useTranslation(['opportunities', 'common'])
  // COLLAPSIBLE-TEXT-1: the always-open editor became the shared collapsed-ghost
  // block (same shape as +Match's Opmerkingen) — local state.
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={cardHead}>{t('modal.groups.description')}</div>
        {/* Danny 14-08 ("de schakelaar" — "the switch"): the same Wizard/Auto switch
            the task modal carries — one shared per-user preference, mirrored, never
            a forked copy. */}
        <NoteKoiosModeToggle />
      </div>
      <div style={cardBox}>
        {/* ARIA-LABEL-1: this modal's own footer button shares the generic
            common:add word with the collapsed-ghost's default placeholder — a
            distinct aria-label (the card's own heading) avoids two controls
            sharing one accessible name. */}
        <CollapsibleRichText t={t} value={value} onChange={onChange}
          expanded={expanded} setExpanded={setExpanded}
          editing={editing} setEditing={setEditing}
          placeholder={t('common:add')} ariaLabel={t('modal.groups.description')}
          assistModes={['improve', 'summarize', 'actions']} />
      </div>
    </div>
  )
}
