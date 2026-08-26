/**
 * DocumentTypesSettings — see the fuller docblock below, right above the
 * component, for the entity-scoped document-type CRUD editor this file renders.
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { DOC_TYPE_ICON_NAMES, resolveDocTypeIcon } from '@/lib/useDocumentTypes'
import NumberSettingField from '../components/NumberSettingField'

// entity → the nav.<id> label already registered for this tab (registry.jsx dt_*
// items), reused so each entity name is translated once (mirrors NoteTypesSettings'
// own ENTITY_NAV_ID pattern, one map per lookup family). Only the entities the
// registry's document_types group actually offers today (DOCTYPE-READERS-1,
// 2026-08-05) — contact/opportunity/task/call_list/match are withheld there (no
// real FE reader yet, see registry.jsx's own comment) and have no entry here either.
const ENTITY_NAV_ID = {
  candidate: 'dt_candidate', customer: 'dt_customer', customer_location: 'dt_customer_location',
  customer_department: 'dt_customer_department', vacancy: 'dt_vacancy',
}

// Tenant-setting key — the generic /settings key/value store (no dedicated column,
// SettingController::store accepts any string key up to 10000 chars, no whitelist —
// verified against koiosmatch-api). Consumed by the backend `documents:expiring-alerts`
// command (DispatchExpiringDocumentAlerts::SETTING_KEY) to decide how many days before
// a requires_expiry document's expires_at the `candidate.document_expiring` automation
// event fires (workflows + webhooks). Same commit-on-blur / optimistic / revert pattern
// as the Koios conversation-memory field (WhatsAppLog.tsx), now the shared NumberSettingField.
export const DOCUMENT_EXPIRING_ALERT_DAYS_KEY = 'document_expiring_alert_days'
const EXPIRING_ALERT_DAYS_DEFAULT = 30
const EXPIRING_ALERT_DAYS_MIN = 1
const EXPIRING_ALERT_DAYS_MAX = 365

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
 *
 * DOC-GELDIGHEID-1: a type also carries an optional expiry configuration —
 * `requires_expiry` (flagField) marks a type whose documents carry an expiry date,
 * and `default_validity_months` (numberField) is the fallback validity
 * CandidateDocumentController/DocumentExpiryResolver auto-computes expires_at from
 * on upload when the client sends none (or 422s when neither exists). Both keys are
 * accepted by CandidateDocumentTypeController::extraRules() — verified against the
 * backend controller before wiring.
 */
export default function DocumentTypesSettings({ entity }) {
  const { t } = useTranslation('settings')
  const entityLabel = t(`nav.${ENTITY_NAV_ID[entity] ?? entity}`)
  return (
    <div style={{ maxWidth: 640 }}>
      {/* Tenant-wide expiry-alert window — candidate scope only (see the field's own comment). */}
      {entity === 'candidate' && (
        <NumberSettingField id="document-expiring-alert-days" settingsKey={DOCUMENT_EXPIRING_ALERT_DAYS_KEY}
          title={t('documentTypes.expiringAlertDaysTitle')} hint={t('documentTypes.expiringAlertDaysHint')}
          label={t('documentTypes.expiringAlertDaysLabel')} saveFailedMessage={t('documentTypes.expiringAlertDaysSaveFailed')}
          defaultValue={EXPIRING_ALERT_DAYS_DEFAULT} min={EXPIRING_ALERT_DAYS_MIN} max={EXPIRING_ALERT_DAYS_MAX} />
      )}
      <StatusListEditor withColor entity={entity}
        title={t('documentTypes.title', { entity: entityLabel })} subtitle={t('documentTypes.subtitle')}
        endpoint="/document-types" addLabel={t('documentTypes.add')}
        iconPicker={{ icons: DOC_TYPE_ICON_NAMES, resolve: resolveDocTypeIcon }}
        numberField={{ key: 'default_validity_months', label: t('documentTypes.defaultValidityMonths'),
          default: null, min: 1, max: 1200, suffix: t('documentTypes.validityMonthsSuffix') }}
        flagField={{ key: 'requires_expiry', label: t('documentTypes.requiresExpiry'), description: t('documentTypes.requiresExpiryDesc') }} />
    </div>
  )
}
