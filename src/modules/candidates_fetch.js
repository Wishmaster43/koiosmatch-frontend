// candidates_fetch module — fetch candidates from the connected planning system.
import { UserSearch } from 'lucide-react'

export default {
  type:  'candidates_fetch',
  app:   ['shiftmanager','intus','aelio','elanza'],
  category: 'Kandidaten',
  label: 'Kandidaten Ophalen',
  Icon:  UserSearch,
  color: '#2563EB',
  bg:    '#EFF6FF',
  schema: [
    { key: 'status',   label: 'Status',          type: 'select',      options: ['alle', 'active', 'inactive', 'available', 'uitgeschreven'] },
    { key: 'pools',    label: 'Pools',            type: 'multiselect', options: ['Pool 7', 'Pool 8', 'Pool 9', 'Pool 10', 'Pool ZZP'] },
    { key: 'features', label: 'Vaardigheden',     type: 'multiselect', options: ['BHV', 'Nachtdienst', 'Gastouder', 'Verzorging IG'] },
    { key: 'limit',    label: 'Max. kandidaten',  type: 'number',      placeholder: '100' },
    { key: 'order_by', label: 'Sortering',        type: 'select',      options: ['naam', 'inschrijfdatum', 'laatste_dienst'] },
  ],
}
