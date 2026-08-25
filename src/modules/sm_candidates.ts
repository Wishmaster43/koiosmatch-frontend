// sm_candidates module — fetch candidates from Shiftmanager.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_candidates',
  // GET/read side: gated on the reports MODULE 'sm' (Danny 23-07); the connector app only gates the POST/PATCH coupling side.
  module: 'sm',
  category: 'Shiftmanager',
  label: 'Kandidaten',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    // Which Shiftmanager link to sync from (tenant-scoped options from the API).
    { key: 'connection_id', label: 'Shiftmanager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'search',   label: 'Zoeken',           type: 'text',   placeholder: 'naam of e-mail' },
    { key: 'status',   label: 'Status',           type: 'select', options: ['alle', 'actief', 'inactief', 'beschikbaar'], default: 'alle' },
    { key: 'limit',    label: 'Max. items',       type: 'number', default: 500, placeholder: '500' },
    { key: 'order_by', label: 'Sortering',        type: 'select', options: ['naam', 'inschrijfdatum'], default: 'naam' },
  ],
}
