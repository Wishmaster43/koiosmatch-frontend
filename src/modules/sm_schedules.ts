// sm_schedules module — fetch TODAY'S scheduled shifts from Shiftmanager (live,
// dynamic date at run time). One pipeline bundle per schedule with a derived
// `daypart` (day/evening/night) so a Router splits on it (ShiftReminder flow).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_schedules',
  // GET/read side: gated on the reports MODULE 'sm' (Danny 23-07); the connector
  // app only gates the POST/PATCH coupling side.
  module: 'sm',
  category: 'Shiftmanager',
  label: 'Ingeplande diensten',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    { key: 'connection_id', label: 'Shiftmanager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    // Window in days relative to the run day: 0 = today, 1 = tomorrow, etc.
    { key: 'offset_from', label: 'Vanaf (dagen vanaf vandaag)', type: 'number', default: 0, placeholder: '0' },
    { key: 'offset_to',   label: 'T/m (dagen vanaf vandaag)',   type: 'number', default: 0, placeholder: '0' },
    { key: 'limit', label: 'Max. items', type: 'number', default: 500, placeholder: '500' },
  ],
}
