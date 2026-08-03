import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { DOC_TYPE_ICON_NAMES, resolveDocTypeIcon } from '@/lib/useDocumentTypes'

// entity → the nav.<id> label already registered for this tab (registry.jsx dt_*
// items), reused so each entity name is translated once (mirrors NoteTypesSettings'
// own ENTITY_NAV_ID pattern, one map per lookup family).
const ENTITY_NAV_ID = {
  candidate: 'dt_candidate', customer: 'dt_customer', customer_location: 'dt_customer_location',
  customer_department: 'dt_customer_department', contact: 'dt_contact', opportunity: 'dt_opportunity',
  task: 'dt_task', call_list: 'dt_call_list', match: 'dt_match', vacancy: 'dt_vacancy',
}

/**
 * Document types — categorisation + colour + icon of documents (CV, ID, diploma, …),
 * scoped per entity (backend CandidateDocumentType::ENTITIES, DOCTYPE-ENTITY-1). One
 * shared StatusListEditor instance per entity sub-tab (registry.jsx `document_types`
 * group), mirroring the NoteTypesSettings wave exactly — a document type created for
 * "Kandidaat" no longer leaks into "Klant".
 *
 * DOCTYPE-STRICT-1: replaces the old bespoke multi-tab-in-one-component wrapper and
 * its "Global row" (entity=null shown on every tab) protection. That protection kept
 * an edit from ever sending `entity`, on purpose, to stop a Global row being silently
 * narrowed. The backend's own `?entity=` scope is now STRICT (CandidateDocumentTypeController
 * ::index() docblock: "narrows STRICTLY to that entity's own types (global rows
 * excluded)" — a deliberate change away from an earlier orWhereNull fallback, to match
 * NoteTypeController::scopeIndex() exactly). A Global row no longer surfaces on any
 * scoped tab, so the old protection was guarding a fallback the backend no longer
 * serves — StatusListEditor's plain `entity` prop (send it on every create AND edit,
 * same as NoteTypesSettings) is now the correct, matching behaviour.
 *
 * Document types carry BOTH a colour (`withColor`, backend `hasColor = true`) and a
 * curated icon (`iconPicker`, backend DOCTYPE-ICON-1) — note types have neither.
 */
export default function DocumentTypesSettings({ entity }) {
  const { t } = useTranslation('settings')
  const entityLabel = t(`nav.${ENTITY_NAV_ID[entity] ?? entity}`)
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor entity={entity}
        title={t('documentTypes.title', { entity: entityLabel })} subtitle={t('documentTypes.subtitle')}
        endpoint="/document-types" addLabel={t('documentTypes.add')}
        iconPicker={{ icons: DOC_TYPE_ICON_NAMES, resolve: resolveDocTypeIcon }} />
    </div>
  )
}
