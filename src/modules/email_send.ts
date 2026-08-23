// email_send module — send a templated e-mail per bundle candidate (or to a backoffice
// role). Field keys mirror App\Workflow\Modules\EmailSendModule::configSchema() exactly
// (WF-BUILDER-VELDEN-1); the old `to`/`template` fields never existed in the BE schema
// and were never read by execute() — replaced here by the real subject/body pair.
import { Mail } from 'lucide-react'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tintBg } from '@/lib/tint'

export default {
  type:  'email_send',
  category: 'Communicatie',
  label: 'E-mail Sturen',
  Icon:  Mail,
  color: 'var(--module-brown)',
  bg:    tintBg('var(--module-brown)'),
  schema: [
    { key: 'subject',              label: 'Onderwerp',              type: 'text',     placeholder: 'Dienst overzicht' },
    // Simple {{field}} substitution from the bundle row (EmailSendModule::execute) — the
    // textarea's variable-picker ("{ }") appears automatically once upstream modules
    // expose fields (fields.tsx), so this reuses the SAME picker as every other text/
    // textarea field rather than a second variable-mapping UI.
    { key: 'body',                 label: 'Bericht',                type: 'textarea' },
    // Which mail sender/context this send uses (Settings → Communicatie contexts).
    { key: 'sender_context',       label: 'Afzender-context',       type: 'select', options: ['kandidaten','algemeen'], default: 'kandidaten' },
    // Tenant-lookup message purpose (message_purposes) — same lookup as whatsapp_send's
    // `purpose`, so the two channels share one badge/filter vocabulary on the timeline.
    { key: 'purpose',              label: 'Berichtdoel',            type: 'lookup_select', endpoint: '/message-purposes', default: 'manual' },
    // P11-FASE4 (VERJAARDAG-XOR): skip this e-mail leg when the bundle's own value for
    // this field is truthy (the sibling WhatsApp leg already covers that candidate).
    { key: 'skip_if_consent_field', label: 'Overslaan bij toestemmingsveld (XOR)', type: 'text',
      help: 'Optioneel. Bijv. whatsapp_consent: sla deze e-mail over als de kandidaat dat veld op waar heeft staan (voorkomt dubbele verzending naast een WhatsApp-stap).' },
    // AVG-flow: set to mail every central user holding this role instead of the
    // candidate bundle (a backoffice notification with no candidate to loop over).
    { key: 'recipient_role',       label: 'Ontvanger-rol (backoffice)', type: 'text',
      help: 'Optioneel. Zet een rolnaam (bv. backoffice) om deze stap naar iedereen met die rol te sturen in plaats van naar de kandidaat-bundel.' },
  ],
}
