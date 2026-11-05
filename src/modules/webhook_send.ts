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
  category: 'communication',
  label: 'Send webhook',
  Icon:  Webhook,
  color: 'var(--module-info)',
  bg:    'var(--color-info-bg)',
  schema: [
    { key: 'url', label: 'Endpoint URL (https)', type: 'text',
      placeholder: 'https://hook.example.com/koios',
      hint: 'Direct https URL for this step. Leave blank to use the shared setting webhook_endpoint_<slug> below. No credentials in the URL.' },
    { key: 'endpoint', label: 'Endpoint slug (shared setting)', type: 'text',
      hint: 'Only used if no URL is set above: the tenant setting webhook_endpoint_<slug> then determines the URL.' },
    { key: 'direction', label: 'Direction/label for the receiver', type: 'text',
      hint: 'Free text/label for the recipient.' },
  ],
}
