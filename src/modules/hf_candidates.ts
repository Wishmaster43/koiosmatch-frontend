// hf_candidates module — fetch candidates from HelloFlex.
import HelloFlexMark from '../components/ui/HelloFlexMark'

export default {
  type:  'hf_candidates',
  // GET/read side: gated on the reports MODULE 'hf' (Danny 23-07); 'helloflex' was moreover never a valid app key.
  module: 'hf',
  category: 'HelloFlex',
  label: 'Kandidaten',
  Icon:  HelloFlexMark,
  color: 'var(--module-helloflex)',
  bg:    'color-mix(in srgb, var(--module-helloflex) 12%, transparent)',
  schema: [
    { key: 'search',   label: 'Zoeken',           type: 'text',   placeholder: 'naam of e-mail' },
    // OPEN (r2): no BE hf-filter equivalent was found for this option set — the
    // real HelloFlex vocabulary is unmeasured; awaiting BE truth before changing values.
    { key: 'status',   label: 'Status',           type: 'select', options: ['alle', 'actief', 'inactief', 'beschikbaar'] },
    { key: 'limit',    label: 'Max. kandidaten',  type: 'number', placeholder: '100' },
    { key: 'order_by', label: 'Sortering',        type: 'select', options: ['naam', 'inschrijfdatum', 'laatste_dienst'] },
  ],
}
