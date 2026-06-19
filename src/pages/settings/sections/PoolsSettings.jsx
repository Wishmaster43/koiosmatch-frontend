import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Talent pools — name + colour CRUD (and drag-reorder), like the other lookups.
 * Backed by /pools; the same colour drives the chips in the candidate list/drawer. */
export default function PoolsSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('poolsSettings.title')}
      subtitle={t('poolsSettings.subtitle')}
      endpoint="/pools"
      addLabel={t('poolsSettings.add')}
      withColor
    />
  )
}
