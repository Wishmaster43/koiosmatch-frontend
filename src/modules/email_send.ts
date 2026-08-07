// email_send module — send an email message.
import { Mail } from 'lucide-react'

export default {
  type:  'email_send',
  category: 'Communicatie',
  label: 'E-mail Sturen',
  Icon:  Mail,
  color: 'var(--module-brown)',
  bg:    'color-mix(in srgb, var(--module-brown) 10%, transparent)',
  schema: [
    { key: 'to',      label: 'Aan',       type: 'text',   placeholder: 'flex@yesway.nu' },
    { key: 'subject', label: 'Onderwerp', type: 'text',   placeholder: 'Dienst overzicht' },
    { key: 'template',label: 'Template',  type: 'select', options: ['shift_summary','no_response_report','daily_overview'] },
  ],
}
