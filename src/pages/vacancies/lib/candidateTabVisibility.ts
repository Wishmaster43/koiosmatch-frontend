/**
 * candidateTabVisibility — pure config logic for the vacancy drawer's "Kandidaten
 * zoeken" tab (candidateSearch): both the tab-visibility GATE (per vacancy status)
 * and the default FILTER preselection (deployability status + contract form) are
 * stored under the same tenant `vacancy_candidate_tab` settings key, so one function
 * (`getCandidateTabDefaults`) computes every seed-based default and both the
 * settings screen and the search-tab hook read the same values (Danny 23-07: this
 * mirrors the candidate side's `candidate_vacancy_tab` — see the reference
 * implementation `pages/candidates/lib/vacancyTabVisibility.ts`).
 */
import type { LookupItem } from '@/context/LookupsContext'
import type { VacancyLookupItem } from '@/context/VacancyLookupsContext'

// Only the fields this module reads — structurally compatible with the real
// LookupItem[]/VacancyLookupItem[] the contexts expose, so callers can pass
// either straight through without an adapter.
type LookupLike = Pick<LookupItem, 'value' | 'label'>
type VacancyLookupLike = Pick<VacancyLookupItem, 'value' | 'label'>

// Stored under the `vacancy_candidate_tab` settings key. All THREE arrays are ALWAYS
// persisted together by the settings screen (never a partial patch), so a later
// lookup addition never silently flips behaviour for an existing tenant.
export interface CandidateTabConfig {
  // Vacancy-status GATE (Danny 23-07): statuses for which the tab is VISIBLE;
  // default = every current tenant vacancy status (no restriction, tab visible everywhere).
  vacancy_statuses?: string[]
  // Default deployability-STATUS preselection for the tab's own candidate search
  // filter — not a gate, just which statuses come pre-checked when the tab first opens.
  candidate_statuses?: string[]
  // Default contract-form (Contractvorm) preselection for the same filter — empty
  // means no restriction (every contract form included), never a "hide" gate.
  contract_forms?: string[]
}

// Case/whitespace-tolerant compare — tenant lookup values are normally trimmed
// slugs, but stay defensive against stray casing/whitespace in stored data.
const norm = (v?: string | null): string => (v ?? '').trim().toLowerCase()

/**
 * Compute the DEFAULT config from the tenant's current lookups. These are
 * DEFAULTS ONLY (seed-based, regex on value/label) — the tenant's saved
 * `vacancy_candidate_tab` setting, once it exists, always overrides them. This is
 * what a fresh tenant effectively sees before ever opening the settings screen,
 * and what the settings screen shows as its initial (pre-save) state.
 */
export function getCandidateTabDefaults(
  vacancyStatuses: VacancyLookupLike[],
  candidateStatuses: LookupLike[] = [],
  // Accepted for call-site symmetry with the settings screen (which already holds
  // the tenant's contract-form lookup on hand) and so a future non-empty default
  // never needs a signature change — unused today, since contract_forms defaults
  // to "no restriction" regardless of which contract forms exist.
  _candidateTypes: LookupLike[] = [],
): Required<CandidateTabConfig> {
  // Deliberately unused (see the param comment above) — marks it "read" for lint.
  void _candidateTypes
  // Every current tenant vacancy status — the tab is visible everywhere by default.
  const defaultVacancyStatuses = vacancyStatuses.map(s => s.value)
  // Soft default (seed-based, regex — never a hardcoded vocabulary): whichever
  // deployability status reads as "available" preselects the candidate filter.
  // EXACT match (trimmed) — a substring test would also hit "Niet beschikbaar"/
  // "unavailable", silently preselecting the opposite of what Danny wants —
  // acceptable since this is only a SOFT, tenant-overridable default (Settings
  // always wins once configured), not a hard business rule.
  const defaultCandidateStatuses = candidateStatuses
    .filter(s => /^\s*(beschikbaar|available)\s*$/i.test(s.value) || /^\s*(beschikbaar|available)\s*$/i.test(s.label))
    .map(s => s.value)
  // No contract-form restriction by default — nothing preselected means every
  // contract form is included in the search results.
  const defaultContractForms: string[] = []
  return { vacancy_statuses: defaultVacancyStatuses, candidate_statuses: defaultCandidateStatuses, contract_forms: defaultContractForms }
}

/**
 * Whether the "Kandidaten zoeken" tab should show for this vacancy. A key PRESENT
 * in cfg wins ENTIRELY over the default (even an empty array — an explicit "no
 * statuses selected" means never show). A vacancy status value not present in the
 * tenant's current lookup (renamed/removed — vocabulary drift) always stays
 * visible: it can never have been deliberately unchecked in a settings screen that
 * only renders checkboxes for currently-known lookup values, so hiding it would
 * silently hide the tab instead of reflecting a real tenant decision.
 */
export function isCandidateTabVisible(
  cfg: CandidateTabConfig | null | undefined,
  vacancy: { status?: string | null },
  vacancyStatuses: VacancyLookupLike[],
): boolean {
  const defaults = getCandidateTabDefaults(vacancyStatuses)
  const allowedStatuses = cfg?.vacancy_statuses ?? defaults.vacancy_statuses

  const status = norm(vacancy.status)
  const statusKnown = vacancyStatuses.some(s => norm(s.value) === status)
  return !status || !statusKnown || allowedStatuses.some(v => norm(v) === status)
}
