// feeder module — feed an array into the flow one item at a time.
import { Database } from 'lucide-react'

export default {
  type:  'feeder',
  category: 'Flow beheer',
  label: 'Data Invoer',
  Icon:  Database,
  color: '#475569',
  bg:    '#F1F5F9',
  schema: [
    {
      key:         'data',
      label:       'Data (JSON)',
      type:        'textarea',
      placeholder: '[\n  { "id": 1, "naam": "Jan" },\n  { "id": 2, "naam": "Petra" }\n]',
      help:        'Plak hier een JSON array of object. De volgende module ontvangt dit als input.',
    },
    {
      key:   'output_type',
      label: 'Uitvoer als',
      type:  'select',
      options: ['Array (meerdere bundles)', 'Enkel object'],
      help:  'Array stuurt elk item apart door naar de volgende module (zoals een Iterator).',
    },
  ],
}
