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
    // WhatsApp send FORMAT; key stays as the BE contract expects. (The old
    // priority_type field left with the private-WhatsApp outbox, Danny 2026-07-08.)
    // 'session' = free-form text, only delivered inside Meta's 24h customer-service
    // window (the BE gates on the conversation's last inbound message).
    { key: 'message_type',        label: 'Formaat',                type: 'select',  options: ['template','flow','session'] },
    // Live options from the tenant's WABA connection (Make parity): active sender
    // numbers + approved templates (the endpoint also returns each template's
    // components for the future per-{{n}} mapping UI).
    { key: 'phone_number_id',     label: 'Afzender',               type: 'lookup_select', endpoint: '/whatsapp-phone-numbers' },
    // Template picker + per-{{n}} variable mapping + live preview (WhatsappTemplateField).
    // Persists template_name/header_variables/variables/language in the same shape as the
    // old lookup_select + two textareas (ONE PER LINE → {{1}},{{2}},…); only shown for the
    // 'template' format, mirroring session_text's own showIf below.
    { key: 'template_name',       label: 'Template',               type: 'whatsapp_template',
      showIf: { key: 'message_type', value: 'template' } },
    { key: 'language',            label: 'Taal',                   type: 'text',    placeholder: 'nl' },
    // Free-form session text — only shown (and sent) for the 'session' format.
    { key: 'session_text',        label: 'Berichttekst (sessie)',  type: 'textarea',
      placeholder: 'Hoi {{firstname}}, …', showIf: { key: 'message_type', value: 'session' } },
    { key: 'update_conversation', label: 'Gespreksstatus updaten', type: 'boolean' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',        type: 'number',  placeholder: '30' },
  ],
}
