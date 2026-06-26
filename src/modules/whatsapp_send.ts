// whatsapp_send module — send a WhatsApp message to a candidate (requires the WhatsApp app).
import { MessageCircle } from 'lucide-react'

export default {
  type:  'whatsapp_send',
  app:   'whatsapp',
  category: 'Communicatie',
  label: 'WhatsApp Sturen',
  Icon:  MessageCircle,
  color: '#3B6D11',
  bg:    '#EAF3DE',
  schema: [
    { key: 'message_type',        label: 'Berichttype',            type: 'select',  options: ['template','flow'] },
    { key: 'phone_number_id',     label: 'Afzender',               type: 'select',  options: ['085 020 5160 (Yesway)','085 020 5161 (Yesway 2)'] },
    { key: 'template_name',       label: 'Template naam',          type: 'text',    placeholder: 'geen_reactie_shiftmanager' },
    { key: 'update_conversation', label: 'Gespreksstatus updaten', type: 'boolean' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',        type: 'number',  placeholder: '30' },
  ],
}
