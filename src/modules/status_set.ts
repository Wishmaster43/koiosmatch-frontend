// status_set module — set a candidate's status from the workflow (native ATS step).
import { UserCheck } from 'lucide-react'

export default {
  type:  'status_set',
  category: 'Kandidaten',
  label: 'Status zetten',
  Icon:  UserCheck,
  color: 'var(--module-teal-strong)',
  bg:    'color-mix(in srgb, var(--module-teal-strong) 4%, transparent)',
  schema: [
    { key: 'status', label: 'Nieuwe status', type: 'lookup_select', endpoint: '/candidate-statuses' },
  ],
}
