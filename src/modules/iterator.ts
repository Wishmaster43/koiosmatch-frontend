// iterator module — split an array so the following steps run once per item.
import { Repeat } from 'lucide-react'

export default {
  type:  'iterator',
  category: 'flow',
  label: 'Iterator',
  Icon:  Repeat,
  color: 'var(--module-purple)',
  bg:    'var(--color-violet-bg)',
  schema: [
    {
      key:   'source_field',
      label: 'Array field',
      type:  'text',
      placeholder: '{{1.output}} or leave empty for the full output',
      help:  'Which field from the previous module holds the array to iterate over.',
    },
  ],
}
