// feeder module — feed an array into the flow one item at a time.
import { Database } from 'lucide-react'

export default {
  type:  'feeder',
  category: 'flow',
  label: 'Data input',
  Icon:  Database,
  color: 'var(--module-slate)',
  bg:    'color-mix(in srgb, var(--module-slate) 8%, transparent)',
  schema: [
    {
      key:         'data',
      label:       'Data (JSON)',
      type:        'textarea',
      placeholder: '[\n  { "id": 1, "name": "Jan" },\n  { "id": 2, "name": "Petra" }\n]',
      help:        'Paste a JSON array or object here. The next module receives it as input.',
    },
    {
      key:   'output_type',
      label: 'Output as',
      type:  'select',
      options: ['Array (meerdere bundles)', 'Enkel object'],
      help:  'Array sends each item to the next module separately (like an Iterator).',
    },
  ],
}
