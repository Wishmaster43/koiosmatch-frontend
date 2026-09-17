/**
 * requiredFieldsCatalog (application) — FIELDS-2-FE-3 (17-09): kept ONLY as the
 * `key -> labelKey` map for `ApplicationRequiredFieldsSettings` (VERPLICHTE-VELDEN-
 * INVENTARIS-1). The row SET and the `requirable`/`reason` flags now come from
 * `GET /settings/field-inventory?entity=application` (`useFieldInventory`), never a
 * hand-curated field list — the old `APPLICATION_FIELDS` array drifted from the
 * backend's actual whitelist (only 4 of 13 published keys, and the map first
 * missed `phase_key` too — since fixed) exactly the way the
 * candidate/customer catalogues did, and is removed here (DEAD-CODE-PROOF-1: no
 * remaining reader — grep confirms only this module's own now-deleted export).
 *
 * Every label REUSES an existing i18n key already shown elsewhere for that exact
 * field where one exists (the application drawer's own field labels); where no
 * existing label exists anywhere in the app (candidate_id/new_candidate — the
 * candidate is inherent context in both create entry points, never shown as a
 * field; rejection_reason_id/interview_flow_id/interview_workflow_id/match_score/
 * match_criteria — no create-time input surfaces these today), a dedicated
 * `settings:applicationRequiredFields.fieldLabels.*` key is added instead of
 * inventing a second copy of an unrelated label (mirrors the customer catalogue's
 * own `contract_types`/`contract_end_date` precedent).
 */
export const APPLICATION_FIELD_LABEL_KEYS: Record<string, string> = {
  source: 'applications:drawer.source',
  vacancy_id: 'applications:drawer.vacancy',
  owner_id: 'applications:drawer.owner',
  application_stage_id: 'applications:drawer.phase',
  custom_fields: 'candidates:drawer.customFields',
  // No existing screen names these six yet — new keys.
  candidate_id: 'settings:applicationRequiredFields.fieldLabels.candidateId',
  new_candidate: 'settings:applicationRequiredFields.fieldLabels.newCandidate',
  rejection_reason_id: 'settings:applicationRequiredFields.fieldLabels.rejectionReason',
  interview_flow_id: 'settings:applicationRequiredFields.fieldLabels.interviewFlow',
  interview_workflow_id: 'settings:applicationRequiredFields.fieldLabels.interviewWorkflow',
  match_score: 'settings:applicationRequiredFields.fieldLabels.matchScore',
  match_criteria: 'settings:applicationRequiredFields.fieldLabels.matchCriteria',
  // No DB column the guard can read back (requirable:false) — still needs a real
  // label, distinct from application_stage_id's "Fase", so the row never renders
  // its raw key.
  phase_key: 'settings:applicationRequiredFields.fieldLabels.phaseKey',
}
