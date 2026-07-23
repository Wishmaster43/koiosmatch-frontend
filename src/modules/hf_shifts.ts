// hf_shifts module — fetch shifts (diensten) from HelloFlex.
import HelloFlexMark from '../components/ui/HelloFlexMark'

export default {
  type:  'hf_shifts',
  // GET/lees-kant: gate op de rapporten-MODULE 'hf' (Danny 23-07); 'helloflex' was bovendien nooit een geldige app-key.
  module: 'hf',
  category: 'HelloFlex',
  label: 'Diensten',
  Icon:  HelloFlexMark,
  color: '#3E7C8C',
  bg:    '#E4EFF2',
  schema: [
    { key: 'client',    label: 'Klant',         type: 'text',   placeholder: 'bijv. Yesway' },
    { key: 'status',    label: 'Status',        type: 'select', options: ['alle', 'open', 'bezet', 'geannuleerd', 'voltooid'] },
    { key: 'date_from', label: 'Datum van',     type: 'text',   placeholder: 'YYYY-MM-DD' },
    { key: 'date_to',   label: 'Datum t/m',     type: 'text',   placeholder: 'YYYY-MM-DD' },
    { key: 'limit',     label: 'Max. diensten', type: 'number', placeholder: '500' },
  ],
}
