// error_resume module — error handler: substitute a fallback value and continue on error.
import { PlayCircle } from 'lucide-react'

export default {
  type:     'error_resume',
  category: 'flow',
  label:    'Resume',
  Icon:     PlayCircle,
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  color:    'var(--color-success)',
  bg:       'var(--color-success-bg)',
  schema: [
    { key: 'fallback_value', label: 'Replacement value', type: 'text', placeholder: 'Value that replaces the failing output', help: 'The run continues as if the module had returned this value.' },
  ],
}
