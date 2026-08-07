// sm_shifts module — sync shifts (diensten) from Shiftmanager into the mirror.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_shifts',
  // GET/lees-kant: gate op de rapporten-MODULE 'sm' (Danny 23-07); de connector-app gate alleen de POST/PATCH-koppelkant.
  module: 'sm',
  category: 'Shiftmanager',
  label: 'Diensten',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  // Only fields the sync actually reads (client/status were dead leftovers).
  schema: [
    { key: 'connection_id', label: 'Shiftmanager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'date_from', label: 'Datum van',  type: 'date' },
    { key: 'date_to',   label: 'Datum t/m',  type: 'date' },
    { key: 'limit',     label: 'Max. items', type: 'number', default: 500, placeholder: '500' },
  ],
}
