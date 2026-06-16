// candidate_filter module — keep only the candidates that match the given criteria.
import { Users } from 'lucide-react'

export default {
  type:  'candidate_filter',
  app:   ['shiftmanager','intus','aelio','elanza'],
  category: 'Kandidaten',
  label: 'Kandidaten Filter',
  Icon:  Users,
  color: '#534AB7',
  bg:    '#EEEDFE',
  schema: [
    { key: 'status',                label: 'Status',              type: 'select',      options: ['actief','inactief','alle'] },
    { key: 'pools',                 label: 'Pools',               type: 'multiselect', options: ['Pool 7','Pool 8','Pool 9','Pool 10','Pool ZZP'] },
    { key: 'days_since_last_shift', label: 'Dagen zonder dienst', type: 'number',      placeholder: '30' },
    { key: 'features',              label: 'Vaardigheden',        type: 'multiselect', options: ['BHV','Nachtdienst','Gastouder','Verzorging IG'] },
    { key: 'limit',                 label: 'Max. kandidaten',     type: 'number',      placeholder: '100' },
  ],
}
