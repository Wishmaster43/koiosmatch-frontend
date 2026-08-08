/**
 * ReferenceExperienceGate — the honest gate for "a reference belongs to a work
 * experience" (Danny 08-08, punt 4: the referee was the manager AT that employer).
 *
 * MEASURED 09-08 against the live tenant API (http://koiosmatch-api.test,
 * X-Tenant: yesway) BEFORE building anything, and the backend carries no such
 * link in either direction — so the searchable picker is deliberately NOT built
 * (§3: never a control whose PATCH the server drops) and this one calm notice
 * stands in its place until the contract lands. Four sources agree:
 *
 *  - candidate_references (create_candidate_references_table): first/middle/
 *    last_name, function, employer, phone, mobile, email, relation_id,
 *    verified_at/by, note, document_id — there is no experience FK column.
 *  - CandidateReference::$fillable and CandidateReferenceController::rules():
 *    no work_experience_id / experience_id key, so validate() strips it.
 *  - ReferenceResource: never serialises one, so a stored link could not even be
 *    read back to render the "employer · function · period" line.
 *  - LIVE probe: POST /candidates/{id}/references and PATCH /candidates/{id}/
 *    references/{item} with work_experience_id — and with experience_id /
 *    candidate_experience_id — answer 201/200 while SILENTLY dropping the field
 *    (the response body never echoes it). That is the exact fake-affordance trap
 *    §3 names: a picker on top of this would look saved and be gone on reload.
 *  - The reverse direction is empty too: candidate_work_experiences has no
 *    reference_id and ExperienceResource does not expose one.
 *
 * TO ACTIVATE (handed to the manager/CMBE): add `work_experience_id` to
 * candidate_references (nullable uuid) + CandidateReference::$fillable +
 * CandidateReferenceController::rules() as a scoped-exists rule on THIS
 * candidate's own candidate_work_experiences (mirror the document_id rule, so it
 * is IDOR-safe), and serialise `work_experience_id` + a nested `work_experience`
 * on ReferenceResource (mirror the nested `document`). No new route is needed —
 * the existing PATCH /candidates/{candidate}/references/{item} carries it, and
 * unlinking is that same PATCH with `work_experience_id: null`.
 */
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// One calm notice per tab — never a per-row disabled button, which would still
// read as "clickable later" for a feature that has no persistence path at all.
// Styling mirrors PlanningTab's own read-only gate (tokens only, §4).
export default function ReferenceExperienceGate() {
  const { t } = useTranslation('candidates')
  return (
    <div data-testid="reference-experience-gate"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 10, padding: '8px 10px',
        borderRadius: 8, background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)',
      }}>
      <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>
        {t('references.experienceLinkUnavailable')}
      </span>
    </div>
  )
}
