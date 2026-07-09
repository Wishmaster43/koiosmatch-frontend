// sm_employees module — fetch employees (medewerkers) from ShiftManager, one
// pipeline bundle per employee (feeds the employee status-change flow).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'sm_employees',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'SM medewerkers',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'connection_id', label: 'ShiftManager-account', type: 'lookup_select', endpoint: '/planning-connections' },
    { key: 'limit', label: 'Max. items', type: 'number', default: 10000, placeholder: '10000' },
  ],
}
