// error_ignore module — error handler: swallow the error and continue the flow.
import { EyeOff } from 'lucide-react'

export default {
  type:     'error_ignore',
  category: 'Flow beheer',
  label:    'Negeren',
  Icon:     EyeOff,
  color:    '#6B7280',
  bg:       '#F3F4F6',
  schema: [
    { key: 'info', label: 'Werking', type: 'textarea', placeholder: 'De fout wordt genegeerd en de uitvoering gaat door met de volgende bundle.' },
  ],
}
