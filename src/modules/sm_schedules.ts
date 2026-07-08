// sm_schedules module — fetch TODAY'S scheduled shifts from ShiftManager (live,
// dynamic date at run time). One pipeline bundle per schedule with a derived
// `daypart` (dag/avond/nacht) so a Router splits on it (ShiftReminder flow).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_schedules',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'Ingeplande diensten',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'connection_id', label: 'ShiftManager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    // Window in days relative to the run day: 0 = vandaag, 1 = morgen, enz.
    { key: 'offset_from', label: 'Vanaf (dagen vanaf vandaag)', type: 'number', default: 0, placeholder: '0' },
    { key: 'offset_to',   label: 'T/m (dagen vanaf vandaag)',   type: 'number', default: 0, placeholder: '0' },
    { key: 'limit', label: 'Max. items', type: 'number', default: 500, placeholder: '500' },
  ],
}
