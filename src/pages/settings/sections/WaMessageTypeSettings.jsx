/**
 * WaMessageTypeSettings — WhatsApp message types: Danny's own outbound-message
 * classification (Sollicitatie/Match/Herinnering/…). Tenant-maintainable lookup
 * backed by /whatsapp-message-types; feeds the whatsapp_send step's
 * priority_type and drives the WABA queue ordering + the Wachtrij tab's type
 * chip. Was an orphaned CRUD (endpoint existed, no settings UI) — WABA-round
 * find 2026-07-10.
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

export function WaMessageTypeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* showRank: this is the ONE list where order IS a send priority (sort_order
          drives WhatsAppSendModule::queueForMessageType's high/low queue split, api
          app/Workflow/Modules/WhatsAppSendModule.php:260-276) — the rank number makes
          that "1 = sent first" semantic explicit, unlike a plain display-order lookup. */}
      {/* X-27 (07-09): the backend validates `is_priority` (boolean) and `daily_cap`
          (1..10000, nullable) on this lookup — the editor exposes both, otherwise the
          queue's priority lane and the per-type cap would be unreachable from the UI. */}
      <StatusListEditor compact withColor withValueSlug showRank
        title={t('waMessageTypes.title')} subtitle={t('waMessageTypes.subtitle')}
        endpoint="/whatsapp-message-types" addLabel={t('waMessageTypes.add')}
        flagFields={[{ key: 'is_priority', label: t('waMessageTypes.isPriority'), description: t('waMessageTypes.isPriorityDesc') }]}
        numberField={{ key: 'daily_cap', label: t('waMessageTypes.dailyCap'), default: null, min: 1, max: 10000, suffix: t('waMessageTypes.dailyCapSuffix') }} />
    </div>
  )
}
