// repeater module — repeat the following steps a configured number of times.
import { RefreshCw } from 'lucide-react'

export default {
  type:     'repeater',
  category: 'flow',
  label:    'Repeater',
  Icon:     RefreshCw,
  color:    'var(--module-purple)',
  bg:       'var(--color-violet-bg)',
  schema: [
    {
      key:         'repeats',
      label: 'Number of repeats',
      type:        'number',
      placeholder: '5',
      help:        'How many times the following modules run.',
    },
    {
      key:         'initial_value',
      label: 'Start value',
      type:        'number',
      placeholder: '1',
      help:        'Start value of the counter ({{i}}) on the first repeat.',
    },
    {
      key:         'step',
      label: 'Step size',
      type:        'number',
      placeholder: '1',
      help:        'How much the counter increments per repeat.',
    },
  ],
}
