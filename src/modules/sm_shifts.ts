// sm_shifts module — fetch shifts (diensten) from ShiftManager.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_shifts',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'Diensten',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    // Which ShiftManager link to sync from (tenant-scoped options from the API).
    { key: 'connection_id', label: 'Bron (API / tenant)', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'client',    label: 'Klant',         type: 'text',   placeholder: 'klantnaam' },
    { key: 'status',    label: 'Status',        type: 'select', options: ['alle', 'open', 'bezet', 'geannuleerd', 'voltooid'] },
    { key: 'date_from', label: 'Datum van',     type: 'text',   placeholder: 'YYYY-MM-DD' },
    { key: 'date_to',   label: 'Datum t/m',     type: 'text',   placeholder: 'YYYY-MM-DD' },
    { key: 'limit',     label: 'Max. items',    type: 'number', default: 500, placeholder: '500' },
  ],
}
