// error_rollback module — error handler: roll back the current transaction on error.
import { RotateCcw } from 'lucide-react'

export default {
  type:     'error_rollback',
  category: 'Flow beheer',
  label:    'Terugdraaien (Rollback)',
  Icon:     RotateCcw,
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  color:    'var(--color-warning)',
  bg:       'var(--color-warning-bg)',
  schema: [
    { key: 'info', label: 'Werking', type: 'textarea', placeholder: 'Alle in deze uitvoering verwerkte bundles worden teruggedraaid. De hele uitvoering mislukt.' },
  ],
}
