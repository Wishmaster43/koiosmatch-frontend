// candidate_filter module — fetch/narrow the candidate list from the planning
// connection (the first step of the Offering Shifts chains).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'candidate_filter',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'Kandidaten ophalen',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'status', label: 'Status', type: 'select', options: ['actief', 'nietactief'], default: 'actief' },
  ],
}
