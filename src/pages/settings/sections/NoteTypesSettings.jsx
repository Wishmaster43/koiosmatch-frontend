import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

// entity → the nav.<id> label already registered for the matching custom-fields
// sub-tab (registry.jsx cf_* items), reused so the entity name is translated once
// (mirrors CustomFieldsSettings' own ENTITY_NAV_ID). "contact" has no cf_contact
// item of its own — it reuses cf_customer_contact's "Contactpersonen/Contacts".
const ENTITY_NAV_ID = {
  candidate: 'cf_candidate', application: 'cf_application', match: 'cf_match', task: 'cf_task',
  customer: 'cf_customer', contact: 'cf_customer_contact', opportunity: 'cf_opportunity',
}

/** Note types — categorisation of notes, scoped per entity (NOTE-TYPES-2/3; backend
 * NoteType::ENTITIES). One shared StatusListEditor instance per entity sub-tab, mirroring
 * the "Eigen velden" custom-fields wave — a note type created for "Kandidaat" no longer
 * leaks into "Klant" (replaces the old flat cross-entity list). */
export default function NoteTypesSettings({ entity }) {
  const { t } = useTranslation('settings')
  const entityLabel = t(`nav.${ENTITY_NAV_ID[entity] ?? entity}`)
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor={false} entity={entity}
        title={t('noteTypes.title', { entity: entityLabel })} subtitle={t('noteTypes.subtitle')}
        endpoint="/note-types" addLabel={t('noteTypes.add')} />
    </div>
  )
}
