/**
 * mapCvProposal — the CV-parse PROPOSAL contract (CV-PARSER-2, entry b) turned
 * into the model the application drawer renders, plus the diff builder that
 * answers the only question a recruiter has: "what is in the dossier now, and
 * what would this CV make of it?"
 *
 * MEASURED CONTRACT (routes/api/tenant/candidates.php:63-65 + CvParseProposalResource):
 *   GET  /candidates/{candidate}/cv-parse-proposals                   candidates.view
 *   POST /candidates/{candidate}/cv-parse-proposals/{proposal}/accept candidates.update
 *   POST /candidates/{candidate}/cv-parse-proposals/{proposal}/reject candidates.update
 *   resource: { id, application_id, status, fields, model, reviewed_by,
 *               reviewed_at, created_at, applied_fields, skipped_fields }
 * The list is CANDIDATE-scoped, never application-scoped — a candidate who applied
 * twice with a CV gets one proposal per parsed document — so the drawer filters on
 * `application_id` itself.
 *
 * WHY A PROPOSAL AND NOT A WRITE: a careersite CV arrives with NO human present.
 * ParseApplicationCvJob therefore never touches the candidate; it parks the parse
 * result as a pending proposal that a recruiter takes over (or does not). That
 * confirmation step is the entire safety design, so nothing in this module ever
 * writes and nothing here ever presents a value as already saved.
 *
 * THE ALLOW-LIST IS RE-ENFORCED HERE. CvParsingService::sanitizeFields() already
 * limits `fields` to name/contact/date-of-birth/work history/education and emits
 * no free text — a care CV routinely carries a sentence like "na mijn burn-out
 * weer opgebouwd", and that health data must never reach a dossier that flows on
 * into exports and into the proposal CV sent to a client. We do not TRUST that at
 * the boundary: every key outside the two allow-lists below is dropped here as
 * well, so a future backend field (a summary, a motivation, a remark) can never
 * render itself into this block by accident.
 *
 * Nothing in this module logs — the payload is special-category personal data (§8).
 */
import type { Id } from '@/types/common'

/**
 * The scalar fields the parser proposes, in the order the block renders them.
 * Mirrors CvParseProposalApplier::SCALAR_FIELDS exactly — the applier only ever
 * writes these, so showing anything else would be a fake affordance.
 */
export const CV_PROPOSAL_SCALAR_FIELDS = [
  'first_name', 'last_name', 'date_of_birth',
  'email', 'phone', 'mobile',
  'street', 'house_number', 'postcode', 'city',
] as const

export type CvProposalScalarField = (typeof CV_PROPOSAL_SCALAR_FIELDS)[number]

/**
 * Proposal key → the key the SAME value carries on GET /candidates/{id}.
 * The candidate contract spells one of them differently: the column is
 * `postcode`, but CandidateDetailResource emits it as `postal_code` (measured
 * 02-08). Reading `postcode` off the candidate response would make a filled
 * postcode look empty and promise a fill that the applier then skips.
 */
export const CANDIDATE_FIELD_ALIASES: Partial<Record<CvProposalScalarField, string>> = {
  postcode: 'postal_code',
}

/** One work-experience row as the parser proposes it (append-only on accept). */
export interface CvProposalExperience {
  company: string
  position: string
  location: string
  startDate: string
  endDate: string
}

/** One education row as the parser proposes it (append-only on accept). */
export interface CvProposalEducation {
  degree: string
  school: string
  issueDate: string
}

/** The raw resource, read defensively — every field may be absent or null. */
export interface ApiCvParseProposal {
  id?: Id
  application_id?: Id | null
  status?: string
  fields?: Record<string, unknown> | null
  model?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string | null
  applied_fields?: string[] | null
  skipped_fields?: string[] | null
}

export type CvProposalStatus = 'pending' | 'accepted' | 'rejected'

/** The UI model of one proposal. */
export interface CvProposal {
  id: Id
  applicationId: Id | null
  status: CvProposalStatus
  /** The served AI model — support/traceability only, never a decision input. */
  model: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string | null
  /** Only the allow-listed scalars that actually carry a value. */
  scalars: Partial<Record<CvProposalScalarField, string>>
  experiences: CvProposalExperience[]
  educations: CvProposalEducation[]
  /** Present only on an accept RESPONSE: which fields landed / were kept as-is. */
  appliedFields: string[]
  skippedFields: string[]
  /**
   * NAMES of payload keys we refused to map (never their values). Exposed so the
   * block can say "n fields were ignored" and so a regression test can prove a
   * free-text field never reaches the UI.
   */
  droppedFieldKeys: string[]
}

/** One row of the "now vs. from the CV" comparison. */
export interface CvProposalDiffRow {
  field: CvProposalScalarField
  proposed: string
  /** The candidate's value today; '' when the dossier has nothing there. */
  current: string
  /** True when the dossier is blank here, so the fill-blank-only merge will write it. */
  willFill: boolean
}

export interface CvProposalDiff {
  rows: CvProposalDiffRow[]
  fillCount: number
  keepCount: number
}

/**
 * Tolerant text read. Laravel serialises some columns as strings and a house
 * number could arrive as a number, so coerce rather than type-check (§10) —
 * `typeof x === 'number'` gates have silently nulled real data here before.
 */
const toText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** Map one experience row; mirrors the applier's "company required" rule. */
const mapExperience = (row: Record<string, unknown>): CvProposalExperience => ({
  company: toText(row.company),
  position: toText(row.position),
  location: toText(row.location),
  startDate: toText(row.start_date),
  endDate: toText(row.end_date),
})

/** Map one education row; mirrors the applier's "degree required" rule. */
const mapEducation = (row: Record<string, unknown>): CvProposalEducation => ({
  degree: toText(row.degree),
  school: toText(row.school),
  issueDate: toText(row.issue_date),
})

// Keys we knowingly handle; anything else in `fields` is dropped and counted.
const KNOWN_FIELD_KEYS = new Set<string>([...CV_PROPOSAL_SCALAR_FIELDS, 'work_experiences', 'educations'])

/** Only 'accepted'/'rejected' are decided states; anything else reads as pending. */
const toStatus = (raw: unknown): CvProposalStatus =>
  raw === 'accepted' || raw === 'rejected' ? raw : 'pending'

/** Raw proposal → UI model, dropping every key outside the allow-list. */
export function mapCvProposal(raw: ApiCvParseProposal = {}): CvProposal {
  const fields = (raw.fields ?? {}) as Record<string, unknown>

  // Scalars: keep only allow-listed keys that carry a real value.
  const scalars: Partial<Record<CvProposalScalarField, string>> = {}
  for (const key of CV_PROPOSAL_SCALAR_FIELDS) {
    const value = toText(fields[key])
    if (value) scalars[key] = value
  }

  // Repeatables: the applier requires company/degree, so a row without one is
  // never appended — dropping it here keeps the shown count equal to what lands.
  const experiences = (Array.isArray(fields.work_experiences) ? fields.work_experiences : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    .map(mapExperience)
    .filter(row => row.company !== '')
  const educations = (Array.isArray(fields.educations) ? fields.educations : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    .map(mapEducation)
    .filter(row => row.degree !== '')

  // Anything the payload carries beyond the allow-list is refused — key names
  // only, so a dropped free-text value never reaches memory the UI can render.
  const droppedFieldKeys = Object.keys(fields).filter(key => !KNOWN_FIELD_KEYS.has(key))

  return {
    id: raw.id ?? '',
    applicationId: raw.application_id ?? null,
    status: toStatus(raw.status),
    model: raw.model ?? null,
    reviewedBy: raw.reviewed_by ?? null,
    reviewedAt: raw.reviewed_at ?? null,
    createdAt: raw.created_at ?? null,
    scalars,
    experiences,
    educations,
    appliedFields: Array.isArray(raw.applied_fields) ? raw.applied_fields : [],
    skippedFields: Array.isArray(raw.skipped_fields) ? raw.skipped_fields : [],
    droppedFieldKeys,
  }
}

/**
 * Build the "now vs. from the CV" comparison for one proposal against the
 * candidate's CURRENT record (the raw GET /candidates/{id} body).
 *
 * `willFill` reproduces CvParseProposalApplier's rule exactly: a field is only
 * ever written when the candidate's own value is blank; anything already filled
 * is kept. The recruiter therefore reads the true outcome BEFORE accepting,
 * instead of discovering it in the applied/skipped summary afterwards.
 *
 * Pass a LOADED candidate record — call this only once that fetch resolved, or
 * every field would look blank and promise a fill that never happens.
 */
export function buildCvProposalDiff(proposal: CvProposal, candidate: Record<string, unknown>): CvProposalDiff {
  const rows: CvProposalDiffRow[] = CV_PROPOSAL_SCALAR_FIELDS
    .filter(field => Boolean(proposal.scalars[field]))
    .map(field => {
      const current = toText(candidate[CANDIDATE_FIELD_ALIASES[field] ?? field])
      return { field, proposed: proposal.scalars[field] as string, current, willFill: current === '' }
    })

  return {
    rows,
    fillCount: rows.filter(row => row.willFill).length,
    keepCount: rows.filter(row => !row.willFill).length,
  }
}
