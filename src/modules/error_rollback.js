import { RotateCcw } from 'lucide-react'

export default {
  type:     'error_rollback',
  category: 'Foutafhandeling',
  label:    'Terugdraaien (Rollback)',
  Icon:     RotateCcw,
  color:    '#D97706',
  bg:       '#FFFBEB',
  schema: [
    { key: 'info', label: 'Werking', type: 'textarea', placeholder: 'Alle in deze uitvoering verwerkte bundles worden teruggedraaid. De hele uitvoering mislukt.' },
  ],
}
