// hf_candidates module — fetch candidates from HelloFlex.
import HelloFlexMark from '../components/ui/HelloFlexMark'

export default {
  type:  'hf_candidates',
  // GET/lees-kant: gate op de rapporten-MODULE 'hf' (Danny 23-07); 'helloflex' was bovendien nooit een geldige app-key.
  module: 'hf',
  category: 'HelloFlex',
  label: 'Kandidaten',
  Icon:  HelloFlexMark,
  color: '#3E7C8C',
  bg:    '#E4EFF2',
  schema: [
    { key: 'search',   label: 'Zoeken',           type: 'text',   placeholder: 'naam of e-mail' },
    { key: 'status',   label: 'Status',           type: 'select', options: ['alle', 'actief', 'inactief', 'beschikbaar'] },
    { key: 'limit',    label: 'Max. kandidaten',  type: 'number', placeholder: '100' },
    { key: 'order_by', label: 'Sortering',        type: 'select', options: ['naam', 'inschrijfdatum', 'laatste_dienst'] },
  ],
}
