// hf_customers module — fetch customers from HelloFlex.
import HelloFlexMark from '../components/ui/HelloFlexMark'

export default {
  type:  'hf_customers',
  // GET/lees-kant: gate op de rapporten-MODULE 'hf' (Danny 23-07); 'helloflex' was bovendien nooit een geldige app-key.
  module: 'hf',
  category: 'HelloFlex',
  label: 'Klanten',
  Icon:  HelloFlexMark,
  color: '#3E7C8C',
  bg:    '#E4EFF2',
  schema: [
    { key: 'search', label: 'Zoeken',        type: 'text',   placeholder: 'klantnaam' },
    { key: 'status', label: 'Status',        type: 'select', options: ['alle', 'actief', 'inactief'] },
    { key: 'limit',  label: 'Max. klanten',  type: 'number', placeholder: '100' },
  ],
}
