import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Last-contact types — the channel of the last contact (Email/Phone/WhatsApp).
 * Tenant-maintainable lookup, backed by /last-contact-types (C-21). Feeds the
 * candidate `last_contact_type` field + the list column. */
export function LastContactTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor={false}
        title={t('lastContactTypes.title')} subtitle={t('lastContactTypes.subtitle')}
        endpoint="/last-contact-types" addLabel={t('lastContactTypes.add')} withIcon />
    </div>
  )
}

/** Note types — categorisation of candidate notes. Tenant-maintainable lookup,
 * backed by /note-types (C-21). */
export function NoteTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor={false}
        title={t('noteTypes.title')} subtitle={t('noteTypes.subtitle')}
        endpoint="/note-types" addLabel={t('noteTypes.add')} />
    </div>
  )
}
