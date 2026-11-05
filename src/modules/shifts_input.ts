// shifts_input module — provide shifts as manual input (requires a planning app).
import { ClipboardList } from 'lucide-react'

export default {
  type:  'shifts_input',
  app:   ['shiftmanager','intus','aelio','elanza'],
  category: 'planning',
  label: 'Paste shifts',
  Icon:  ClipboardList,
  color: 'var(--color-archive)',
  bg:    'var(--color-warning-bg)',
  schema: [
    {
      key:         'shift_ids',
      label: 'Shift IDs',
      type:        'textarea',
      placeholder: 'Paste shift IDs here, one per line or comma-separated:\n12345\n12346\n12347',
      help:        'Each line or comma-separated value is treated as a separate shift ID.',
    },
    {
      key:   'id_field',
      label: 'ID field name',
      type:  'select',
  app:   ['shiftmanager','intus','aelio','elanza'],
      options: ['id', 'external_id', 'shift_number'],
      help:  'Which field is used as the identifier in the next module.',
    },
  ],
}
