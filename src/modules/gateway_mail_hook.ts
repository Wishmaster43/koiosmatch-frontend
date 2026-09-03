// gateway_mail_hook module — trigger: start the workflow when a mail hook receives a message.
import { Mail } from 'lucide-react'

export default {
  type:     'gateway_mail_hook',
  makeType: 'gateway:CustomMailHook',
  // audit module-schema-reconcile-4 (CMBE 03-09, grep 0): no engine class and no inbound
  // route exist for this card, so it cannot be added any more; saved nodes still render.
  hidden:   true,
  category: 'Triggers',
  label:    'Mail Hook',
  Icon:     Mail,
  color:    'var(--module-info)',
  bg:       'var(--color-info-bg)',
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
