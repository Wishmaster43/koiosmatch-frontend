// gateway_mail_hook module — trigger: start the workflow when a mail hook receives a message.
import { Mail } from 'lucide-react'

export default {
  type:     'gateway_mail_hook',
  makeType: 'gateway:CustomMailHook',
  category: 'Triggers',
  label:    'Mail Hook',
  Icon:     Mail,
  color:    '#0369A1',
  bg:       '#E0F2FE',
  schema: [
    {
      key:         'hook',
      label:       'Mailhook',
      type:        'text',
      placeholder: 'Hook ID of naam',
      required:    true,
    },
    {
      key:         'maxResults',
      label:       'Max. resultaten',
      type:        'number',
      placeholder: '1',
    },
  ],
}
