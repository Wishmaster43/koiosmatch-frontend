// whatsapp_send module — send a WhatsApp message to a candidate (requires the WhatsApp app).
import { MessageCircle } from 'lucide-react'

export default {
  type:  'whatsapp_send',
  module: 'whatsapp',
  category: 'Communicatie',
  label: 'WhatsApp Sturen',
  Icon:  MessageCircle,
  color: '#3B6D11',
  bg:    '#EAF3DE',
  schema: [
    // WhatsApp send FORMAT; key stays as the BE contract expects.
    // 'session' = free-form text, only delivered inside Meta's 24h customer-service
    // window (the BE gates on the conversation's last inbound message).
    { key: 'message_type',        label: 'Formaat',                type: 'select',  options: ['template','flow','session'] },
    // Live options from the tenant's WABA connection (Make parity): active sender
    // numbers + approved templates (the endpoint also returns each template's
    // components for the future per-{{n}} mapping UI).
    { key: 'phone_number_id',     label: 'Afzender',               type: 'lookup_select', endpoint: '/whatsapp-phone-numbers' },
    // Recipient override: empty = each bundle's own mobile; a literal 06-number
    // redirects EVERY message there (dry-run testing, Danny 2026-07-09).
    { key: 'recipient_field',     label: 'Ontvanger',              type: 'text',
      placeholder: 'leeg = mobiel van de kandidaat · eigen 06 = testmodus' },
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
    // Danny's own message classification (NOT the send format above) — drives queue
    // order in the WABA batch (Wachtrij tab). Tenant lookup, CRUD'd via Settings.
    { key: 'priority_type',       label: 'Berichttype (classificatie)', type: 'lookup_select', endpoint: '/whatsapp-message-types' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',        type: 'number',  placeholder: '30' },
  ],
}
