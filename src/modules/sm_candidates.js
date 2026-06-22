// sm_candidates module — fetch candidates from ShiftManager.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_candidates',
  category: 'ShiftManager',
  label: 'Kandidaten',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'search',   label: 'Zoeken',           type: 'text',   placeholder: 'naam of e-mail' },
    { key: 'status',   label: 'Status',           type: 'select', options: ['alle', 'actief', 'inactief', 'beschikbaar'] },
    { key: 'limit',    label: 'Max. kandidaten',  type: 'number', placeholder: '100' },
    { key: 'order_by', label: 'Sortering',        type: 'select', options: ['naam', 'inschrijfdatum', 'laatste_dienst'] },
  ],
}
