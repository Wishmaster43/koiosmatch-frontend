// hf_shifts module — fetch shifts (diensten) from HelloFlex.
import HelloFlexMark from '../components/ui/HelloFlexMark'

export default {
  type:  'hf_shifts',
  // GET/read side: gated on the reports MODULE 'hf' (Danny 23-07); 'helloflex' was, moreover, never a valid app key.
  module: 'hf',
  category: 'HelloFlex',
  label: 'Diensten',
  Icon:  HelloFlexMark,
  color: 'var(--module-helloflex)',
  bg:    'color-mix(in srgb, var(--module-helloflex) 12%, transparent)',
  schema: [
    { key: 'client',    label: 'Klant',         type: 'text',   placeholder: 'bijv. Yesway' },
    { key: 'status',    label: 'Status',        type: 'select', options: ['alle', 'open', 'bezet', 'geannuleerd', 'voltooid'] },
    // DATUM-1: native date input (mirrors the sm_shifts.ts Shiftmanager sibling) —
    // never a text field with an ISO placeholder shown to the user.
    { key: 'date_from', label: 'Datum van',     type: 'date' },
    { key: 'date_to',   label: 'Datum t/m',     type: 'date' },
    { key: 'limit',     label: 'Max. diensten', type: 'number', placeholder: '500' },
  ],
}
