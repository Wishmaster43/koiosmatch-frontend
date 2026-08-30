// webhook module — trigger: start the workflow when its inbound webhook URL is
// called. The webhook is picked (or created inline) from the /webhooks resource;
// one webhook binds to one workflow.
import { Webhook } from 'lucide-react'

export default {
  type:  'webhook',
  // VERTREKMODULE-1 + Appendix H: the inbound webhook is a valid point of origin.
  isStart: true,
  category: 'Triggers',
  label: 'Webhook Trigger',
  Icon:  Webhook,
  color: 'var(--module-info)',
  bg:    'var(--color-info-bg)',
  schema: [
    { key: 'webhook_id',  label: 'Webhook',         type: 'webhook_select',
      hint: 'Kies of maak de inbound webhook die deze workflow start.' },
    { key: 'max_results', label: 'Max. resultaten', type: 'number', placeholder: '1' },
  ],
}
