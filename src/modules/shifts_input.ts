// shifts_input module — provide shifts as manual input (requires a planning app).
import { ClipboardList } from 'lucide-react'

export default {
  type:  'shifts_input',
  app:   ['shiftmanager','intus','aelio','elanza'],
  category: 'Planning',
  label: 'Diensten Plakken',
  Icon:  ClipboardList,
  color: '#B45309',
  bg:    'var(--color-warning-bg)',
  schema: [
    {
      key:         'shift_ids',
      label:       'Dienst IDs',
      type:        'textarea',
      placeholder: 'Plak hier dienst-IDs, één per regel of komma-gescheiden:\n12345\n12346\n12347',
      help:        'Elke regel of komma-gescheiden waarde wordt als apart dienst-ID behandeld.',
    },
    {
      key:   'id_field',
      label: 'ID veld naam',
      type:  'select',
  app:   ['shiftmanager','intus','aelio','elanza'],
      options: ['id', 'external_id', 'shift_number'],
      help:  'Welk veld wordt gebruikt als identifier in de volgende module.',
    },
  ],
}
