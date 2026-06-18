// error_rollback module — error handler: roll back the current transaction on error.
import { RotateCcw } from 'lucide-react'

export default {
  type:     'error_rollback',
  category: 'Foutafhandeling',
  label:    'Terugdraaien (Rollback)',
  Icon:     RotateCcw,
  color:    'var(--color-warning)',
  bg:       'var(--color-warning-bg)',
  schema: [
    { key: 'info', label: 'Werking', type: 'textarea', placeholder: 'Alle in deze uitvoering verwerkte bundles worden teruggedraaid. De hele uitvoering mislukt.' },
  ],
}
