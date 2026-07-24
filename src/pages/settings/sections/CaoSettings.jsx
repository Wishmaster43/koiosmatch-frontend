import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * CaoSettings — the CAO lookup finally gets its Settings home (Danny 24-07:
 * "ik zie geen CAO's bij instellingen" — the /cao endpoint had full CRUD +
 * reorder + in-use 409 (via matches.cao) but no screen, same gap class as
 * provinces). Name-only list; drives the customer price agreements and the
 * + Match popup's CAO picker.
 */
export default function CaoSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor
        title={t('caoSettings.title')}
        subtitle={t('caoSettings.subtitle')}
        endpoint="/cao"
        addLabel={t('caoSettings.add')}
        withColor={false}
      />
    </div>
  )
}
