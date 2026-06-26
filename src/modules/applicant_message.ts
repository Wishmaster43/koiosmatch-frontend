// applicant_message module — send a message to the applicant on the chosen channel:
// e-mail, WhatsApp business, or WhatsApp private (private sends from the application
// owner's personal WhatsApp Web number). The body is a template with dynamic tokens
// like {kandidaat.voornaam} / {afwijsreden}, rendered server-side (see worklist C-32).
import { Send } from 'lucide-react'

export default {
  type:  'applicant_message',
  category: 'Communicatie',
  label: 'Bericht naar sollicitant',
  Icon:  Send,
  color: '#3B6D11',
  bg:    '#EAF3DE',
  schema: [
    { key: 'channel',             label: 'Kanaal',             type: 'select',   options: ['e-mail', 'whatsapp zakelijk', 'whatsapp privé (nummer eigenaar)'] },
    { key: 'subject',             label: 'Onderwerp (e-mail)', type: 'text',     placeholder: 'Je sollicitatie bij {vacature.titel}' },
    { key: 'body',                label: 'Bericht',            type: 'textarea', placeholder: 'Beste {kandidaat.voornaam},\n\nDank voor je sollicitatie. Helaas … ({afwijsreden}).\n\nMet vriendelijke groet,\n{recruiter.naam}' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',    type: 'number',   placeholder: '30' },
  ],
}
