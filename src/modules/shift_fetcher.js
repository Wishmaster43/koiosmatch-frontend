import { Calendar } from 'lucide-react'

export default {
  type:  'shift_fetcher',
  category: 'Diensten',
  label: 'Diensten Ophalen',
  Icon:  Calendar,
  color: '#0F6E56',
  bg:    '#E1F5EE',
  schema: [
    { key: 'connection_id',       label: 'Planning systeem',     type: 'select', options: ['ShiftManager (Yesway)','Intus','SDB'] },
    { key: 'hours_ahead',         label: 'Uren vooruit',         type: 'number', placeholder: '72' },
    { key: 'min_hours_available', label: 'Min. uur beschikbaar', type: 'number', placeholder: '36' },
  ],
}
