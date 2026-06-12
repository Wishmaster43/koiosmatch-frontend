import { CalendarSearch } from 'lucide-react'

export default {
  type:  'shifts_fetch',
  category: 'Diensten',
  label: 'Diensten Ophalen',
  Icon:  CalendarSearch,
  color: '#0F6E56',
  bg:    '#E1F5EE',
  schema: [
    { key: 'client',      label: 'Klant',         type: 'text',   placeholder: 'bijv. Yesway' },
    { key: 'status',      label: 'Status',         type: 'select', options: ['alle', 'open', 'bezet', 'geannuleerd', 'voltooid'] },
    { key: 'location',    label: 'Locatie',        type: 'text',   placeholder: 'bijv. Amsterdam' },
    { key: 'department',  label: 'Afdeling',       type: 'text',   placeholder: 'bijv. Zorg' },
    { key: 'cost_center', label: 'Kostenplaats',   type: 'text',   placeholder: 'bijv. KP-001' },
    { key: 'function',    label: 'Functie',        type: 'text',   placeholder: 'bijv. Verzorgende IG' },
    { key: 'date_from',   label: 'Datum van',      type: 'text',   placeholder: 'YYYY-MM-DD' },
    { key: 'date_to',     label: 'Datum t/m',      type: 'text',   placeholder: 'YYYY-MM-DD' },
    { key: 'time_from',   label: 'Tijd van',       type: 'text',   placeholder: 'bijv. 08:00' },
    { key: 'time_to',     label: 'Tijd t/m',       type: 'text',   placeholder: 'bijv. 17:00' },
    { key: 'candidate',   label: 'Kandidaat',      type: 'select', options: ['alle', 'zonder kandidaat', 'met kandidaat', 'specifiek'] },
    { key: 'candidate_id',label: 'Kandidaat ID',   type: 'text',   placeholder: 'bijv. k_001 (alleen bij "specifiek")' },
    { key: 'limit',       label: 'Max. diensten',  type: 'number', placeholder: '500' },
  ],
}
