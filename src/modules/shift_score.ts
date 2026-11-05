// shift_score module — rank each candidate's fetched shifts and keep the best N
// (urgency, function match, favourite, customer bonus, weekend, preference, duration).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'

export default {
  type:  'shift_score',
  // GET/read side: gated on the reports MODULE 'sm' (Danny 23-07); the connector app only gates the POST/PATCH linking side.
  module: 'sm',
  category: 'shiftmanager',
  label: 'Score shifts',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  schema: [
    { key: 'top_totaal', label: 'Maximum number of shifts', type: 'number', default: 7 },
    { key: 'min_duur',   label: 'Minimum shift duration (hours)', type: 'number', default: 6 },
    { key: 'punten', label: 'Points per factor', type: 'key_value', suggestions: { week_1: '10', week_2: '9', week_3: '8', week_4: '7', functie_primary: '10', functie_secondary: '5', functie_geen_match: '-1000', is_favorite: '5', klant_bonus: '1', klant_malus: '-1', voorkeur_match: '10', weekend: '2', duur_8_plus: '3' }, hint: 'Factors left empty use the default points.' },
    { key: 'klant_aanpassingen', label: 'Customer adjustments (customer id to points)', type: 'key_value', hint: 'Bonus or malus per customer id, for example 2 or -3.' },
    { key: 'functie_matrix', label: 'Function matrix', type: 'function_matrix', hint: 'Per function the primary and secondary function names that count as a match, in lower case.' },
  ],
}
