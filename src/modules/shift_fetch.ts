// shift_fetch module — fetch each candidate's open shifts from Shiftmanager
// (per-candidate eligibility incl. max distance; the Offering Shifts chain).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'shift_fetch',
  // GET/read side: gated on the reports MODULE 'sm' (Danny 23-07); the connector app only gates the POST/PATCH coupling side.
  module: 'sm',
  category: 'Shiftmanager',
  label: 'Open diensten per kandidaat',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    { key: 'max_distance', label: 'Maximale afstand (km)', type: 'number', default: 35, placeholder: '35' },
  ],
}
