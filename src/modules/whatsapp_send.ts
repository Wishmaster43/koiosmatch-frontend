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
    { key: 'template_name',       label: 'Template',               type: 'lookup_select', endpoint: '/whatsapp-templates' },
    // Ordered template variables, ONE PER LINE → {{1}},{{2}},… Each line is a {{veld}}
    // from the pipeline bundle (sm_schedules delivers firstname/job_type/adres/datum_nl/…).
    { key: 'header_variables',    label: 'Header-variabelen (één per regel)', type: 'textarea', placeholder: '{{header_nl}}' },
    { key: 'variables',           label: 'Body-variabelen (één per regel)',   type: 'textarea',
      placeholder: '{{firstname}}\n{{job_type}}\n{{subject}}\n{{adres}}\n{{plaats}}\n{{datum_nl}}\n{{starttijd_nl}}\n{{eindtijd_nl}}' },
    { key: 'language',            label: 'Taal',                   type: 'text',    placeholder: 'nl' },
    // Free-form session text — only shown (and sent) for the 'session' format.
    { key: 'session_text',        label: 'Berichttekst (sessie)',  type: 'textarea',
      placeholder: 'Hoi {{firstname}}, …', showIf: { key: 'message_type', value: 'session' } },
    { key: 'update_conversation', label: 'Gespreksstatus updaten', type: 'boolean' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',        type: 'number',  placeholder: '30' },
  ],
}
