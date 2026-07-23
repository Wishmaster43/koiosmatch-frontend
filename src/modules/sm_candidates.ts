// sm_candidates module — fetch candidates from ShiftManager.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_candidates',
  // GET/lees-kant: gate op de rapporten-MODULE 'sm' (Danny 23-07); de connector-app gate alleen de POST/PATCH-koppelkant.
  module: 'sm',
  category: 'ShiftManager',
  label: 'Kandidaten',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    // Which ShiftManager link to sync from (tenant-scoped options from the API).
    { key: 'connection_id', label: 'ShiftManager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'search',   label: 'Zoeken',           type: 'text',   placeholder: 'naam of e-mail' },
    { key: 'status',   label: 'Status',           type: 'select', options: ['alle', 'actief', 'inactief', 'beschikbaar'], default: 'alle' },
    { key: 'limit',    label: 'Max. items',       type: 'number', default: 500, placeholder: '500' },
    { key: 'order_by', label: 'Sortering',        type: 'select', options: ['naam', 'inschrijfdatum'], default: 'naam' },
  ],
}
