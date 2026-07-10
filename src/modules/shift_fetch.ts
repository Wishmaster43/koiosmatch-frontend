// shift_fetch module — fetch each candidate's open shifts from ShiftManager
// (per-candidate eligibility incl. max distance; the Offering Shifts chain).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'shift_fetch',
  app:   'shiftmanager',
  category: 'ShiftManager',
  label: 'Open diensten per kandidaat',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'max_distance', label: 'Maximale afstand (km)', type: 'number', default: 35, placeholder: '35' },
  ],
}
