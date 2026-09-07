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
    { key: 'punten', label: 'Punten per factor', type: 'key_value', suggestions: { week_1: '10', week_2: '9', week_3: '8', week_4: '7', functie_primary: '10', functie_secondary: '5', functie_geen_match: '-1000', is_favorite: '5', klant_bonus: '1', klant_malus: '-1', voorkeur_match: '10', weekend: '2', duur_8_plus: '3' }, hint: 'Leeg gelaten factoren gebruiken de standaardpunten.' },
    { key: 'klant_aanpassingen', label: 'Klantcorrecties (klant-id naar punten)', type: 'key_value', hint: 'Bonus of malus per klant-id, bijvoorbeeld 2 of -3.' },
    { key: 'functie_matrix', label: 'Functiematrix', type: 'function_matrix', hint: 'Per functie de primaire en secundaire functienamen die als match gelden, kleine letters.' },
  ],
}
