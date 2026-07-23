// shift_fetch module — fetch each candidate's open shifts from ShiftManager
// (per-candidate eligibility incl. max distance; the Offering Shifts chain).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'shift_fetch',
  // GET/lees-kant: gate op de rapporten-MODULE 'sm' (Danny 23-07); de connector-app gate alleen de POST/PATCH-koppelkant.
  module: 'sm',
  category: 'ShiftManager',
  label: 'Open diensten per kandidaat',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'max_distance', label: 'Maximale afstand (km)', type: 'number', default: 35, placeholder: '35' },
  ],
}
