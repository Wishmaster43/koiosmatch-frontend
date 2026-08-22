// calllist_add module (AUTO-CONTACT-1) — add every candidate on the pipeline to a
// named outreach campaign (bellijst), creating it on first run when no campaign
// with that name exists yet. Field key mirrors
// App\Workflow\Modules\CalllistAddModule::configSchema() exactly.
import { PhoneCall } from 'lucide-react'

export default {
  type:  'calllist_add',
  category: 'Kandidaten',
  label: 'Toevoegen aan bellijst',
  Icon:  PhoneCall,
  color: 'var(--module-cyan)',
  bg:    'var(--color-info-bg)',
  schema: [
    // {maand} is a backend template token (idempotent per-month rolling
    // campaign) — kept verbatim, never translated (mirrors {{…}} placeholders).
    { key: 'campaign_name', label: 'Bellijst-naam', type: 'text',
      default: 'Lang geen contact {maand}',
      hint: 'Ondersteunt {maand} voor de huidige maandnaam.' },
  ],
}
