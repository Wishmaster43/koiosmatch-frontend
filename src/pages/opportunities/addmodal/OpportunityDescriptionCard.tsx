/**
 * OpportunityDescriptionCard — the "Kanstekst" card of AddOpportunityModal.
 * Adopts the shared ModalDescriptionCard with opportunity-specific label,
 * Koios assist modes, and the NoteKoiosModeToggle in the header.
 *
 * TASK-ASSIST-ACTIONS-1 (Danny 14-08, "ook bij nieuwe kans"): opts into Koios
 * assist modes — mirrors AddTaskModal's DescriptionCard so Actiepunten suggestions
 * are available while drafting an opportunity's text.
 */
import { useTranslation } from 'react-i18next'
import ModalDescriptionCard from '@/components/forms/ModalDescriptionCard'
import NoteKoiosModeToggle from '@/components/drawer/tabs/notes/NoteKoiosModeToggle'

interface OpportunityDescriptionCardProps {
  value: string
  onChange: (v: string) => void
}

// Opportunity description card — adopts the shared ModalDescriptionCard with assist modes + toggle.
export default function OpportunityDescriptionCard({ value, onChange }: OpportunityDescriptionCardProps) {
  const { t } = useTranslation(['opportunities', 'common'])
  return (
    <ModalDescriptionCard
      value={value}
      onChange={onChange}
      label={t('modal.groups.description')}
      ariaLabel={t('modal.groups.description')}
      placeholder={t('common:add')}
      headerAction={<NoteKoiosModeToggle />}
      assistModes={['improve', 'summarize', 'actions']}
    />
  )
}
