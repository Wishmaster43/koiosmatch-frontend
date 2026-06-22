// applicant_filter module — keep only the applications that match the criteria
// (e.g. funnel stage 'afgewezen' with a specific rejection reason).
import { Filter } from 'lucide-react'

export default {
  type:  'applicant_filter',
  category: 'Sollicitaties',
  label: 'Sollicitanten Filter',
  Icon:  Filter,
  color: 'var(--color-primary)',
  bg:    'var(--color-primary-bg)',
  schema: [
    { key: 'funnel_stage',     label: 'Funnelfase',         type: 'select', options: ['gesolliciteerd', 'uitgenodigd', 'voorgesteld', 'aangenomen', 'afgewezen', 'alle'] },
    { key: 'rejection_reason', label: 'Afwijsreden',        type: 'text',   placeholder: 'optioneel' },
    { key: 'days_in_stage',    label: 'Dagen in fase',      type: 'number', placeholder: '7' },
    { key: 'limit',            label: 'Max. sollicitanten', type: 'number', placeholder: '100' },
  ],
}
