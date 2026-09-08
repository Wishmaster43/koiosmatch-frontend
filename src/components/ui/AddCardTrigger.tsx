/**
 * AddCardTrigger — full-width trigger to open an add-form card (MatchTemplatesSettings,
 * VacancyContentBlocksSettings, CustomFieldsSettings, VacancyGenerationProfilesList).
 * Button variant="soft" (§4 tint), not DrawerAddButton — this spans the whole card,
 * unlike the row-level "+ add" affordance.
 */
import { Plus } from 'lucide-react'
import Button from '@/components/ui/Button'

export interface AddCardTriggerProps {
  onClick: () => void
  label: string
}

export default function AddCardTrigger({ onClick, label }: AddCardTriggerProps) {
  return (
    <Button variant="soft" size="sm" onClick={onClick} style={{ width: '100%' }}>
      <Plus size={14} /> {label}
    </Button>
  )
}
