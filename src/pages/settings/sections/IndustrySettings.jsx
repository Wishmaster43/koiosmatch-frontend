import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Industries — configurable list used by the company profile dropdown.
 * Backed by /industries. No colour: it is a plain value list. */
export default function IndustrySettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('industrySettings.title')}
      subtitle={t('industrySettings.subtitle')}
      endpoint="/industries"
      addLabel={t('industrySettings.add')}
      withColor={false}
    />
  )
}
