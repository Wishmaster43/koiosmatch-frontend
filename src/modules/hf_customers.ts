// hf_customers module — fetch customers from HelloFlex.
import HelloFlexMark from '../components/ui/HelloFlexMark'

export default {
  type:  'hf_customers',
  // GET/read side: gated on the reports MODULE 'hf' (Danny 23-07); 'helloflex' was moreover never a valid app key.
  module: 'hf',
  category: 'helloflex',
  label: 'Customers',
  Icon:  HelloFlexMark,
  color: 'var(--module-helloflex)',
  bg:    'color-mix(in srgb, var(--module-helloflex) 12%, transparent)',
  schema: [
    { key: 'search', label: 'Search',        type: 'text',   placeholder: 'customer name' },
    { key: 'status', label: 'Status',        type: 'select', options: ['alle', 'actief', 'inactief'] },
    { key: 'limit',  label: 'Max. customers',  type: 'number', placeholder: '100' },
  ],
}
