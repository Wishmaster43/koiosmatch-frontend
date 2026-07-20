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

// Note types moved to their own per-entity settings group (NOTE-TYPES-2/3, Danny
// "ieder zijn eigen" 2026-07-20) — see ./NoteTypesSettings.jsx + registry.jsx's
// `note_types` group, one sub-tab per backend NoteType::ENTITIES value.
