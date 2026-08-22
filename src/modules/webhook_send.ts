// webhook_send module (BIRTHDAY-FLOW-2 contract-sweep) — generic outbound webhook
// step used by the seeded integration templates (Elanza/Aelio/Intus/SDB). The
// endpoint slug resolves to a tenant SETTING (webhook_endpoint_<slug>), never a
// hardcoded URL — a card+schema only here, nothing fires from the registration
// itself. One of the six DryRunPolicy::BLOCKED senders on the backend, so a
// dry-run never actually posts. Field keys mirror
// App\Workflow\Modules\WebhookSendModule::configSchema() exactly.
import { Webhook } from 'lucide-react'

export default {
  type:  'webhook_send',
  category: 'Communicatie',
  label: 'Webhook versturen',
  Icon:  Webhook,
  color: 'var(--module-info)',
  bg:    'var(--color-info-bg)',
  schema: [
    { key: 'endpoint', label: 'Endpoint-slug', type: 'text',
      hint: 'De tenant-instelling webhook_endpoint_<slug> bepaalt de URL.' },
    { key: 'direction', label: 'Richting', type: 'text',
      hint: 'Vrije tekst/label voor de ontvanger.' },
  ],
}
