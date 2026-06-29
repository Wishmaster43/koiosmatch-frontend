import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Document types — categorisation + colour of candidate documents (CV, ID, …).
 * Tenant-maintainable lookup, backed by /document-types. The colour drives the
 * document tile + soft chip in the candidate's Documents tab. */
export default function DocumentTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor
        title={t('documentTypes.title')} subtitle={t('documentTypes.subtitle')}
        endpoint="/document-types" addLabel={t('documentTypes.add')} />
    </div>
  )
}
