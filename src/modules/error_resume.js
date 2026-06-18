// error_resume module — error handler: substitute a fallback value and continue on error.
import { PlayCircle } from 'lucide-react'

export default {
  type:     'error_resume',
  category: 'Foutafhandeling',
  label:    'Hervatten (Resume)',
  Icon:     PlayCircle,
  color:    'var(--color-success)',
  bg:       '#F0FDF4',
  schema: [
    { key: 'fallback_value', label: 'Vervangwaarde', type: 'text', placeholder: 'Waarde die de foutieve output vervangt', help: 'De uitvoering gaat door alsof de module deze waarde heeft teruggegeven.' },
  ],
}
