/**
 * NoteTypesSettings — categorisation of notes, scoped per entity (NOTE-TYPES-2/3;
 * backend NoteType::ENTITIES). One shared StatusListEditor instance per entity
 * sub-tab, mirroring the "Eigen velden" custom-fields wave — a note type
 * created for "Kandidaat" no longer leaks into "Klant" (replaces the old flat
 * cross-entity list).
 *
 * NOTE-TYPES-3: `entity={null}` renders the "General" tab — the entity-less
 * (global) rows every other tab used to inherit silently via the backend's
 * `?entity=X` merge (scopeIndex ORs in `entity IS NULL`). Each entity tab now
 * reads that same merged response but keeps only ITS OWN rows (postFilter), and
 * General reads the unscoped list but keeps only the null-entity rows — so a
 * global row renders in exactly one tab, never duplicated across every entity.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

// entity → the nav.<id> label already registered for the matching custom-fields
// sub-tab (registry.jsx cf_* items), reused so the entity name is translated once
// (mirrors CustomFieldsSettings' own ENTITY_NAV_ID). "contact" has no cf_contact
// item of its own — it reuses cf_customer_contact's "Contactpersonen/Contacts".
const ENTITY_NAV_ID = {
  candidate: 'cf_candidate', application: 'cf_application', match: 'cf_match', task: 'cf_task',
  customer: 'cf_customer', contact: 'cf_customer_contact', opportunity: 'cf_opportunity',
  vacancy: 'cf_vacancy',
}

// Note-type editor scoped to one entity (or the General/global tab when entity is
// null), so a type created for Candidate never leaks into Customer (see file header).
export default function NoteTypesSettings({ entity = null }) {
  const { t } = useTranslation('settings')
  const entityLabel = entity ? t(`nav.${ENTITY_NAV_ID[entity] ?? entity}`) : t('noteTypes.general')
  // Stable per entity: the editor's load effect depends on it, so a fresh arrow per
  // render would refetch on every parent re-render.
  const postFilter = useCallback((row) => (entity ? (row.entity ?? null) === entity : !row.entity), [entity])
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor entity={entity}
        // General reads the unscoped list (no ?entity= param) and keeps only the
        // null-entity rows; an entity tab reads the server's entity+global merge
        // and keeps only rows that actually belong to it.
        fetchEntity={entity ?? undefined}
        postFilter={postFilter}
        title={t('noteTypes.title', { entity: entityLabel })} subtitle={t('noteTypes.subtitle')}
        endpoint="/note-types" addLabel={t('noteTypes.add')} />
    </div>
  )
}
