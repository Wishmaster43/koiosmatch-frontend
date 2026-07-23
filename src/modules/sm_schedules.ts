// sm_schedules module — fetch TODAY'S scheduled shifts from ShiftManager (live,
// dynamic date at run time). One pipeline bundle per schedule with a derived
// `daypart` (dag/avond/nacht) so a Router splits on it (ShiftReminder flow).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_schedules',
  // GET/lees-kant: gate op de rapporten-MODULE 'sm' (Danny 23-07); de connector-app gate alleen de POST/PATCH-koppelkant.
  module: 'sm',
  category: 'ShiftManager',
  label: 'Ingeplande diensten',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'connection_id', label: 'Shiftmanager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    // Window in days relative to the run day: 0 = vandaag, 1 = morgen, enz.
    { key: 'offset_from', label: 'Vanaf (dagen vanaf vandaag)', type: 'number', default: 0, placeholder: '0' },
    { key: 'offset_to',   label: 'T/m (dagen vanaf vandaag)',   type: 'number', default: 0, placeholder: '0' },
    { key: 'limit', label: 'Max. items', type: 'number', default: 500, placeholder: '500' },
  ],
}
