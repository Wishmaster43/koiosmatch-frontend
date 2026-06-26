// repeater module — repeat the following steps a configured number of times.
import { RefreshCw } from 'lucide-react'

export default {
  type:     'repeater',
  category: 'Flow beheer',
  label:    'Repeater',
  Icon:     RefreshCw,
  color:    '#6D28D9',
  bg:       '#EDE9FE',
  schema: [
    {
      key:         'repeats',
      label:       'Aantal herhalingen',
      type:        'number',
      placeholder: '5',
      help:        'Hoe vaak de volgende modules worden uitgevoerd.',
    },
    {
      key:         'initial_value',
      label:       'Beginwaarde',
      type:        'number',
      placeholder: '1',
      help:        'Startwaarde van de teller ({{i}}) bij de eerste herhaling.',
    },
    {
      key:         'step',
      label:       'Stapgrootte',
      type:        'number',
      placeholder: '1',
      help:        'Met hoeveel de teller per herhaling ophoogt.',
    },
  ],
}
