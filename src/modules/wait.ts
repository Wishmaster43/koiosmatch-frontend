// wait module — pause the workflow until a date/field is reached (resumable, Fase 1).
import { Hourglass } from 'lucide-react'

export default {
  type:  'wait',
  category: 'Flow beheer',
  label: 'Wachten tot datum',
  Icon:  Hourglass,
  color: '#5F5E5A',
  bg:    '#F1EFE8',
  schema: [
    { key: 'until_field', label: 'Wachten tot veld', type: 'text',   placeholder: 'available_again_date' },
    { key: 'days',        label: 'Of: aantal dagen',  type: 'number', placeholder: '0' },
  ],
}
