import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { resolveDocTypeIcon, DOC_TYPE_ICON_NAMES } from '@/lib/useDocumentTypes'

/** Document types — categorisation + colour + icon of candidate documents (CV, ID, …).
 * Tenant-maintainable lookup backed by /document-types. Name/colour/reorder/delete
 * AND the curated icon live in ONE shared StatusListEditor row (Danny 23-07: the
 * separate icon block below the list "ziet er niet uit" — the picker is now an
 * in-row control via the editor's iconPicker prop). */
export default function DocumentTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor
        title={t('documentTypes.title')} subtitle={t('documentTypes.subtitle')}
        endpoint="/document-types" addLabel={t('documentTypes.add')}
        iconPicker={{ icons: DOC_TYPE_ICON_NAMES, resolve: resolveDocTypeIcon }} />
    </div>
  )
}
