// shift_score module — rank each candidate's fetched shifts and keep the best N
// (urgency, function match, favourite, customer bonus, weekend, preference, duration).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'shift_score',
  // GET/lees-kant: gate op de rapporten-MODULE 'sm' (Danny 23-07); de connector-app gate alleen de POST/PATCH-koppelkant.
  module: 'sm',
  category: 'ShiftManager',
  label: 'Diensten scoren',
  Icon:  ShiftManagerMark,
  color: '#E11D2A',
  bg:    '#FDECEC',
  schema: [
    { key: 'top_totaal', label: 'Maximaal aantal diensten', type: 'number', default: 7 },
    { key: 'min_duur',   label: 'Minimale dienstduur (uren)', type: 'number', default: 6 },
  ],
}
