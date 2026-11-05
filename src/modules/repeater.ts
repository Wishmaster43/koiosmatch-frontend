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
      help:        'Hoe vaak de volgende modules worden uitgevoerd.',
    },
    {
      key:         'initial_value',
      label: 'Start value',
      type:        'number',
      placeholder: '1',
      help:        'Startwaarde van de teller ({{i}}) bij de eerste herhaling.',
    },
    {
      key:         'step',
      label: 'Step size',
      type:        'number',
      placeholder: '1',
      help:        'Met hoeveel de teller per herhaling ophoogt.',
    },
  ],
}
