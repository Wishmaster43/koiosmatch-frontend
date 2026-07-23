/**
 * vacancyTabVisibility — pure config logic for the candidate drawer's "Vacatures"
 * tab (vacancySearch): both the tab-visibility GATE (phase + deployability status +
 * contract form) and the default FILTER preselection (vacancy statuses) are stored
 * under the same tenant `candidate_vacancy_tab` settings key, so one function
 * (`getVacancyTabDefaults`) computes every seed-based default and both the
 * settings screen and the search-tab hook read the same values (Danny 23-07: a
 * Lead usually has no context yet to search open vacancies against, a candidate
 * flagged Unavailable/blacklisted shouldn't be pushed toward new placements, and
 * only some contract forms may be relevant — but all three are Settings-driven,
 * never hardcoded).
 */
import type { LookupItem } from '@/context/LookupsContext'

// Only the fields this module reads — structurally compatible with the real
// LookupItem[]/VacancyLookupItem[] the contexts expose, so callers can pass
// either straight through without an adapter.
type LookupLike = Pick<LookupItem, 'value' | 'label' | 'is_blacklist'>

// Stored under the `candidate_vacancy_tab` settings key. All FOUR arrays are ALWAYS
// persisted together by the settings screen (never a partial patch), so a later
// lookup addition never silently flips behaviour for an existing tenant.
export interface VacancyTabConfig {
  phases?: string[]
  hidden_statuses?: string[]
  // Contract-form (Contractvorm) gate (Danny 23-07): values for which the tab is
  // VISIBLE; default = every current tenant candidate type (no restriction).
  candidate_types?: string[]
  // Default vacancy-STATUS preselection for the search filter — not a gate, just
  // which statuses come pre-checked when the tab first opens.
  vacancy_statuses?: string[]
}

// Case/whitespace-tolerant compare — tenant lookup values are normally trimmed
// slugs, but stay defensive against stray casing/whitespace in stored data.
const norm = (v?: string | null): string => (v ?? '').trim().toLowerCase()

/**
 * Compute the DEFAULT config from the tenant's current lookups. These are
 * DEFAULTS ONLY (seed-based, regex on value/label) — the tenant's saved
 * `candidate_vacancy_tab` setting, once it exists, always overrides them. This is
 * what a fresh tenant effectively sees before ever opening the settings screen,
 * and what the settings screen shows as its initial (pre-save) state.
 */
export function getVacancyTabDefaults(
  phases: LookupLike[],
  statuses: LookupLike[],
  candidateTypes: LookupLike[] = [],
  vacancyStatuses: LookupLike[] = [],
): Required<VacancyTabConfig> {
  // Every phase EXCEPT ones reading as "Lead" (value or label) — a Lead has
  // typically made no application yet, so vacancy-matching has nothing to anchor on.
  const defaultPhases = phases
    .filter(p => !/lead/i.test(p.value) && !/lead/i.test(p.label))
    .map(p => p.value)
  // Hide for the blacklist flag (flag-driven, never slug-matched — §3B) and any
  // status reading as "unavailable", mirroring the deployability seed.
  const defaultHiddenStatuses = statuses
    .filter(s => s.is_blacklist || /niet beschikbaar|unavailable/i.test(s.value) || /niet beschikbaar|unavailable/i.test(s.label))
    .map(s => s.value)
  // Every tenant contract form is visible by default — no restriction until a
  // tenant explicitly narrows it in Settings.
  const defaultCandidateTypes = candidateTypes.map(ct => ct.value)
  // Soft default (seed-based, regex — never a hardcoded vocabulary): whichever
  // vacancy status reads as "open" preselects the search filter.
  const defaultVacancyStatuses = vacancyStatuses
    .filter(s => /open/i.test(s.value) || /open/i.test(s.label))
    .map(s => s.value)
  return { phases: defaultPhases, hidden_statuses: defaultHiddenStatuses, candidate_types: defaultCandidateTypes, vacancy_statuses: defaultVacancyStatuses }
}

/**
 * Whether the Vacatures tab should show for this candidate. A key PRESENT in cfg
 * wins ENTIRELY over the default for that key (even an empty array — an explicit
 * "no phases selected" means never show). A phase/status/type value not present in
 * the tenant's current lookup (renamed/removed — vocabulary drift) always stays
 * visible: it can never have been deliberately unchecked in a settings screen
 * that only renders checkboxes for currently-known lookup values, so hiding it
 * would silently hide data instead of reflecting a real tenant decision.
 */
export function isVacancyTabVisible(
  cfg: VacancyTabConfig | null | undefined,
  candidate: { phase?: string | null; status?: string | null; candidateTypes?: string[] | null },
  phases: LookupLike[],
  statuses: LookupLike[],
  candidateTypes: LookupLike[] = [],
): boolean {
  const defaults = getVacancyTabDefaults(phases, statuses, candidateTypes)
  const allowedPhases = cfg?.phases ?? defaults.phases
  const hiddenStatuses = cfg?.hidden_statuses ?? defaults.hidden_statuses
  const allowedTypes = cfg?.candidate_types ?? defaults.candidate_types

  const phase = norm(candidate.phase)
  const phaseKnown = phases.some(p => norm(p.value) === phase)
  const phaseOk = !phase || !phaseKnown || allowedPhases.some(v => norm(v) === phase)

  const status = norm(candidate.status)
  const statusOk = !status || !hiddenStatuses.some(v => norm(v) === status)

  // Contract-form (multi-value) gate: visible when the candidate holds no types at
  // all, OR at least one of their types is allowed. An unknown type (renamed/
  // removed lookup value) always counts as allowed — same drift tolerance as
  // phase/status above.
  const candidateTypeValues = (candidate.candidateTypes ?? []).map(norm).filter(Boolean)
  const typesOk = candidateTypeValues.length === 0 || candidateTypeValues.some(v => {
    const known = candidateTypes.some(ct => norm(ct.value) === v)
    return !known || allowedTypes.some(a => norm(a) === v)
  })

  return phaseOk && statusOk && typesOk
}
