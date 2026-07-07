// sm_customers module — sync customers from ShiftManager into the mirror.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_customers',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'Klanten',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  // Only fields the sync actually reads (search/status were dead leftovers).
  schema: [
    { key: 'connection_id', label: 'Bron (API / tenant)', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'limit',  label: 'Max. items',  type: 'number', default: 500, placeholder: '500' },
  ],
}
