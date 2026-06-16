// webhook module — trigger: start the workflow when its webhook URL is called.
import { Webhook } from 'lucide-react'

export default {
  type:  'webhook',
  category: 'Triggers',
  label: 'Webhook Trigger',
  Icon:  Webhook,
  color: '#0369A1',
  bg:    '#E0F2FE',
  schema: [
    { key: 'hook_id',     label: 'Webhook',            type: 'text',   placeholder: 'Whatsapp - Flow' },
    { key: 'max_results', label: 'Max. resultaten',    type: 'number', placeholder: '1' },
  ],
}
