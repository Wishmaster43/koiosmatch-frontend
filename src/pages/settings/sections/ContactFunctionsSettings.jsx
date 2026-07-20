import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * ContactFunctionsSettings — the contact-person job-title list (/contact-functions,
 * FUNCTIONS-SPLIT-1), split off from the candidate function list (Danny 2026-07-20)
 * so a contact's title (e.g. "Locatiemanager") no longer shares one vocabulary with
 * candidate functions. Requested from backend-Claude as its own tenant lookup; it
 * may not be deployed everywhere yet, so StatusListEditor's `notFoundNotice` shows a
 * calm message instead of a dead CRUD editor on a 404 (§3 no fake affordances) and
 * lights up on its own once the route is live — nothing else here needs to change.
 */
export default function ContactFunctionsSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor
        title={t('contactFunctionsSettings.title')}
        subtitle={t('contactFunctionsSettings.subtitle')}
        endpoint="/contact-functions"
        addLabel={t('contactFunctionsSettings.add')}
        withColor={false}
        notFoundNotice={t('contactFunctionsSettings.notAvailable')}
      />
    </div>
  )
}
