import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** WhatsApp message types — Danny's own outbound-message classification
 * (Sollicitatie/Match/Herinnering/…). Tenant-maintainable lookup backed by
 * /whatsapp-message-types; feeds the whatsapp_send step's priority_type and
 * drives the WABA queue ordering + the Wachtrij tab's type chip. Was an
 * orphaned CRUD (endpoint existed, no settings UI) — WABA-round find 2026-07-10. */
export function WaMessageTypeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* Order = queue priority (sort_order via the editor's reorder; no extra field). */}
      <StatusListEditor compact withColor
        title={t('waMessageTypes.title')} subtitle={t('waMessageTypes.subtitle')}
        endpoint="/whatsapp-message-types" addLabel={t('waMessageTypes.add')} />
    </div>
  )
}
