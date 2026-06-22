// applicants_fetch module — fetch applications (sollicitaties) from Koios, optionally
// narrowed by funnel stage (e.g. only 'afgewezen') so a workflow can act on them.
import { ClipboardList } from 'lucide-react'

export default {
  type:  'applicants_fetch',
  category: 'Sollicitaties',
  label: 'Sollicitanten Ophalen',
  Icon:  ClipboardList,
  color: 'var(--color-secondary)',
  bg:    'var(--color-secondary-bg)',
  schema: [
    { key: 'funnel_stage',     label: 'Funnelfase',         type: 'select', options: ['alle', 'gesolliciteerd', 'uitgenodigd', 'voorgesteld', 'aangenomen', 'afgewezen'] },
    { key: 'rejection_reason', label: 'Afwijsreden',        type: 'text',   placeholder: 'optioneel — reden of variabele' },
    { key: 'vacancy',          label: 'Vacature',           type: 'text',   placeholder: 'optioneel — vacature-ID' },
    { key: 'limit',            label: 'Max. sollicitanten', type: 'number', placeholder: '100' },
    { key: 'order_by',         label: 'Sortering',          type: 'select', options: ['datum', 'naam', 'funnelfase'] },
  ],
}
