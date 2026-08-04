import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { resolveGenericLookupIcon } from './lookupIcons'

// Curated contact-channel icon subset (mirrors DocumentTypesSettings' own bespoke
// iconPicker) — a narrower slice of the generic lookupIcons set, scoped to the
// channels this lookup actually represents (Email/Phone/WhatsApp/…).
const CONTACT_CHANNEL_ICON_NAMES = ['mail', 'phone', 'smartphone', 'message-circle', 'message-square', 'video']

/** Last-contact types — the channel of the last contact (Email/Phone/WhatsApp).
 * Tenant-maintainable lookup, backed by /last-contact-types (C-21). Feeds the
 * candidate `last_contact_type` field + the list column. Backend `last_contact_types`
 * carries a colour column too, so the editor now shows colour like every other lookup. */
export function LastContactTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor
        title={t('lastContactTypes.title')} subtitle={t('lastContactTypes.subtitle')}
        endpoint="/last-contact-types" addLabel={t('lastContactTypes.add')}
        iconPicker={{ icons: CONTACT_CHANNEL_ICON_NAMES, resolve: resolveGenericLookupIcon }} />
    </div>
  )
}

// Note types moved to their own per-entity settings group (NOTE-TYPES-2/3, Danny
// "ieder zijn eigen" 2026-07-20) — see ./NoteTypesSettings.jsx + registry.jsx's
// `note_types` group, one sub-tab per backend NoteType::ENTITIES value.
