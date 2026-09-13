import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Industries — configurable list used by the company profile dropdown.
 * Backed by /industries. No colour: it is a plain value list.
 * No withIcon either: industries has neither column yet on the backend
 * (LOOKUP-ICONS-FE-2 round-4 hash, ±19:30 13-09) — revisit once that lands. */
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
