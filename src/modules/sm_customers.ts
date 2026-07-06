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
    // Which ShiftManager link to sync from (tenant-scoped options from the API).
    { key: 'connection_id', label: 'Bron (API / tenant)', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'search', label: 'Zoeken',      type: 'text',   placeholder: 'klantnaam' },
    { key: 'status', label: 'Status',      type: 'select', options: ['alle', 'actief', 'inactief'], default: 'alle' },
    { key: 'limit',  label: 'Max. items',  type: 'number', default: 500, placeholder: '500' },
  ],
}
