// hf_customers module — fetch customers from HelloFlex.
import HelloFlexMark from '../components/ui/HelloFlexMark'

export default {
  type:  'hf_customers',
  // GET/read side: gated on the reports MODULE 'hf' (Danny 23-07); 'helloflex' was moreover never a valid app key.
  module: 'hf',
  category: 'HelloFlex',
  label: 'Klanten',
  Icon:  HelloFlexMark,
  color: 'var(--module-helloflex)',
  bg:    'color-mix(in srgb, var(--module-helloflex) 12%, transparent)',
  schema: [
    { key: 'search', label: 'Zoeken',        type: 'text',   placeholder: 'klantnaam' },
    { key: 'status', label: 'Status',        type: 'select', options: ['alle', 'actief', 'inactief'] },
    { key: 'limit',  label: 'Max. klanten',  type: 'number', placeholder: '100' },
  ],
}
