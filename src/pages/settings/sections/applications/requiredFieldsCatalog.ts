/**
 * requiredFieldsCatalog (application) — the whitelist for the "nieuwe sollicitatie"
 * popup's tenant-configurable required fields (APP-REQUIRED-FE-1, Danny: "hoe zorg
 * ik dat BRON bij nieuwe sollicitatie verplicht is? moet bij instellingen komen" —
 * how do I make SOURCE required on a new application? it should be in settings).
 * Mirrors the backend's `FlatRequiredFieldsGuard('application')`, which reads the
 * flat `application_required_fields` array (no phase axis, unlike the candidate/
 * customer required-fields screens) and 422s `ApplicationController::store`.
 *
 * `candidate_id` is deliberately absent: in both entry points (candidate drawer's
 * "+ Solliciteren" and the applications page's "+ Nieuwe sollicitatie") the
 * candidate is the modal's own inherent context, so requiring it is meaningless.
 *
 * `labelKey` reuses the application drawer's own canonical field labels
 * (ApplicationDetailsCard) — the same key the create modals already use for the
 * same field, so this screen never mints a second translated copy.
 */
import type { RequiredFieldDef } from '../customers/requiredFieldsCatalog'

export const APPLICATION_FIELDS: RequiredFieldDef[] = [
  { key: 'source', labelKey: 'applications:drawer.source' },
  { key: 'vacancy_id', labelKey: 'applications:drawer.vacancy' },
  { key: 'owner_id', labelKey: 'applications:drawer.owner' },
  { key: 'application_stage_id', labelKey: 'applications:drawer.phase' },
]
