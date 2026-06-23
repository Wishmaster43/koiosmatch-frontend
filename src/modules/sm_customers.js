// sm_customers module — fetch customers from ShiftManager.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_customers',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'Klanten',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'search', label: 'Zoeken',        type: 'text',   placeholder: 'klantnaam' },
    { key: 'status', label: 'Status',        type: 'select', options: ['alle', 'actief', 'inactief'] },
    { key: 'limit',  label: 'Max. klanten',  type: 'number', placeholder: '100' },
  ],
}
