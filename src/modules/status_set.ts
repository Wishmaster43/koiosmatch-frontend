// status_set module — set a candidate's status from the workflow (native ATS step).
import { UserCheck } from 'lucide-react'

export default {
  type:  'status_set',
  category: 'Kandidaten',
  label: 'Status zetten',
  Icon:  UserCheck,
  color: '#0F766E',
  bg:    '#F0FDFA',
  schema: [
    { key: 'status', label: 'Nieuwe status', type: 'lookup_select', endpoint: '/candidate-statuses' },
  ],
}
