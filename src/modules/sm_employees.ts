// sm_employees module — fetch employees (medewerkers) from Shiftmanager, one
// pipeline bundle per employee (feeds the employee status-change flow).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_employees',
  // GET/read side: gates on the reports MODULE 'sm' (Danny 23-07); the connector app only gates the POST/PATCH link side.
  module: 'sm',
  category: 'Shiftmanager',
  label: 'SM medewerkers',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    { key: 'connection_id', label: 'Shiftmanager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'limit', label: 'Max. items', type: 'number', default: 10000, placeholder: '10000' },
  ],
}
