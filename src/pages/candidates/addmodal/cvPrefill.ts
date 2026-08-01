/**
 * cvPrefill — pure mapping from the CV-parser payload (GET /candidates/parse-cv/{token})
 * onto this modal's FormState. Side-effect free so the safety rules below are testable
 * without mounting a component.
 *
 * THREE HARD RULES, all deliberate:
 *  1. It only ever produces a PROPOSAL. Nothing here writes to the API — the recruiter
 *     confirms by submitting the create form as usual. That submit is the safety step.
 *  2. It NEVER maps free text. A care CV routinely contains health-adjacent prose
 *     ("na mijn burn-out weer opgebouwd"); auto-landing that in a dossier pushes
 *     special-category data (§8) into exports and into the proposal CV a client gets.
 *     Only the whitelist below can reach the form — an unknown key is dropped silently.
 *  3. It never OVERWRITES. A field the recruiter already typed wins over the parse;
 *     the CV can only fill blanks. Reported back as `skipped` so that stays visible.
 */
import type { FormState } from '../AddCandidateModal'

// One parsed work-experience row, exactly as CvParsingService::schema() emits it.
export interface ParsedCvExperience {
  company: string | null
  position: string | null
  location: string | null
  start_date: string | null
  end_date: string | null
}

// One parsed education row, exactly as CvParsingService::schema() emits it.
export interface ParsedCvEducation {
  degree: string | null
  school: string | null
  issue_date: string | null
}

/**
 * The `fields` object of a ready parse. Hand-written on purpose: the OpenAPI export
 * documents this route's REQUEST only (no 2xx success schema), so §10's type-gen rule
 * points at a hand-written success shape here. Keys mirror the backend JSON Schema —
 * note `postcode`, NOT `postal_code` (measured in CvParsingService::sanitizeFields).
 * The index signature is tolerance, not permission: extra keys are never read.
 */
export interface ParsedCvFields {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  street?: string | null
  house_number?: string | null
  postcode?: string | null
  city?: string | null
  date_of_birth?: string | null
  work_experiences?: ParsedCvExperience[] | null
  educations?: ParsedCvEducation[] | null
  [key: string]: unknown
}

/**
 * The ONLY payload keys allowed to touch the form, and where each lands. Anything
 * absent from this table — today and after any future backend addition — is dropped.
 * Deliberately NOT here:
 *  - every free-text field (rule 2 above);
 *  - `function_title`, which is not parsed at all: deriving it from the newest
 *    `position` would be an INFERENCE the recruiter cannot tell apart from a read
 *    value, and this feature's whole premise is that they can (see cvMarks in the UI).
 */
const FIELD_MAP: ReadonlyArray<readonly [keyof ParsedCvFields, keyof FormState]> = [
  ['first_name', 'firstName'],
  ['last_name', 'lastName'],
  ['email', 'email'],
  ['phone', 'phone'],
  ['mobile', 'mobile'],
  ['street', 'street'],
  ['house_number', 'houseNumber'],
  ['postcode', 'postalCode'],
  ['city', 'city'],
]

// Oldest birth year we accept; anything older is a misread, not a candidate.
const MIN_BIRTH_YEAR = 1900

/**
 * Turn a CV date string into the ISO value a `<input type="date">` needs, or null.
 * STRICT on purpose — AI misreads dates, so a value we cannot read unambiguously is
 * left empty and reported, never guessed into the dossier. Accepts ISO (YYYY-MM-DD)
 * and the numeric Dutch order (D-M-YYYY, also with / or .), because the parser is
 * prompted in Dutch for a Dutch-market CV. Month names, 2-digit years and partial
 * dates are refused.
 */
export function toIsoBirthDate(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value)
  const nl = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value)
  if (!iso && !nl) return null

  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(nl![3]), Number(nl![2]), Number(nl![1])]

  // Real calendar date (rejects 31-02) via a round-trip through UTC.
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null

  // Plausibility bounds: a birthdate is never in the future and never pre-1900.
  if (year < MIN_BIRTH_YEAR || date.getTime() > Date.now()) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/** What a parse proposed, and what actually happened to it — rendered back to the recruiter. */
export interface CvPrefillResult {
  /** Values to merge into the form (blanks only). */
  patch: Partial<FormState>
  /** Fields the CV actually filled — these get the "from CV, check me" mark. */
  filled: Array<keyof FormState>
  /** The CV had a value but the recruiter had already typed one; theirs wins. */
  skipped: Array<keyof FormState>
  /** The CV carried a birthdate we refused to trust (unreadable/implausible). */
  unreadableDate: boolean
  /** Parsed but NOT part of this form — the create endpoint has no route for them. */
  extras: { experiences: number; educations: number }
}

// Trim + drop empties so a whitespace-only parse result never counts as "filled".
const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * Build the prefill proposal from a ready payload against the CURRENT form values.
 * Never mutates its inputs; the caller merges `patch` and renders the rest.
 */
export function buildCvPrefill(fields: ParsedCvFields, current: FormState): CvPrefillResult {
  const patch: Partial<FormState> = {}
  const filled: Array<keyof FormState> = []
  const skipped: Array<keyof FormState> = []

  // Whitelist walk: only the mapped keys are ever read out of the payload.
  for (const [source, target] of FIELD_MAP) {
    const value = clean(fields[source])
    if (!value) continue
    if (clean(current[target])) { skipped.push(target); continue }
    patch[target] = value
    filled.push(target)
  }

  // Birthdate is the one field with a format gate — an unreadable one stays empty.
  const rawDate = clean(fields.date_of_birth)
  const isoDate = toIsoBirthDate(rawDate)
  let unreadableDate = false
  if (rawDate) {
    if (clean(current.dateOfBirth)) skipped.push('dateOfBirth')
    else if (isoDate) { patch.dateOfBirth = isoDate; filled.push('dateOfBirth') }
    else unreadableDate = true
  }

  // Counted, never rendered: work history/education have no field on the create form
  // (POST /candidates writes the candidate row + types + branches, nothing else), so
  // showing them here would be a control that cannot save — the count tells the
  // recruiter to add them in the dossier instead.
  return {
    patch,
    filled,
    skipped,
    unreadableDate,
    extras: {
      experiences: Array.isArray(fields.work_experiences) ? fields.work_experiences.length : 0,
      educations: Array.isArray(fields.educations) ? fields.educations.length : 0,
    },
  }
}
