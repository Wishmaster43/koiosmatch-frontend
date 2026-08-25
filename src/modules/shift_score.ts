// shift_score module — rank each candidate's fetched shifts and keep the best N
// (urgency, function match, favourite, customer bonus, weekend, preference, duration).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'shift_score',
  // GET/read side: gated on the reports MODULE 'sm' (Danny 23-07); the connector app only gates the POST/PATCH linking side.
  module: 'sm',
  category: 'Shiftmanager',
  label: 'Diensten scoren',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    { key: 'top_totaal', label: 'Maximaal aantal diensten', type: 'number', default: 7 },
    { key: 'min_duur',   label: 'Minimale dienstduur (uren)', type: 'number', default: 6 },
  ],
}
