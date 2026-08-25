// applicant_message module — send a message to the applicant on the chosen channel:
// e-mail, WhatsApp business, or WhatsApp private (private sends from the application
// owner's personal WhatsApp Web number). The body is a template with dynamic tokens
// like {kandidaat.voornaam} / {afwijsreden}, rendered server-side (see worklist C-32).
import { Send } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:  'applicant_message',
  category: 'Communicatie',
  label: 'Bericht naar sollicitant',
  Icon:  Send,
  color: 'var(--module-green)',
  bg:    tintBg('var(--module-green)'),
  // FE orphan: no backend module (CMBE 25-08); returns when the engine gets
  // one with channel options email|waba|waba_coex|wa_web. Existing workflow
  // nodes of this type keep rendering — only the picker's new-node offer hides.
  hidden: true,
  schema: [
    { key: 'channel',             label: 'Kanaal',             type: 'select',   options: ['e-mail', 'whatsapp zakelijk', 'whatsapp privé (nummer eigenaar)'] },
    { key: 'subject',             label: 'Onderwerp (e-mail)', type: 'text',     placeholder: 'Je sollicitatie bij {vacature.titel}' },
    { key: 'body',                label: 'Bericht',            type: 'textarea', placeholder: 'Beste {kandidaat.voornaam},\n\nDank voor je sollicitatie. Helaas … ({afwijsreden}).\n\nMet vriendelijke groet,\n{recruiter.naam}' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',    type: 'number',   placeholder: '30' },
  ],
}
