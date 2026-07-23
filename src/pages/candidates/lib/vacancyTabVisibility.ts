/**
 * vacancyTabVisibility — pure gating logic for the candidate drawer's "Vacatures"
 * tab (vacancySearch). Tenant-configurable per phase + deployability status
 * (Danny 23-07): a Lead usually has no context yet to search open vacancies
 * against, and a candidate flagged Unavailable/blacklisted shouldn't be pushed
 * toward new placements — but both are Settings-driven, never hardcoded.
 */
import type { LookupItem } from '@/context/LookupsContext'

// Only the fields this module reads — structurally compatible with the real
// LookupItem[] the LookupsContext exposes (phases/statuses), so callers can
// pass either straight through without an adapter.
type LookupLike = Pick<LookupItem, 'value' | 'label' | 'is_blacklist'>

// Stored under the `candidate_vacancy_tab` settings key. Both arrays are ALWAYS
// persisted together by the settings screen (never a partial patch), so a later
// lookup addition never silently flips behaviour for an existing tenant.
export interface VacancyTabConfig {
  phases?: string[]
  hidden_statuses?: string[]
}

// Case/whitespace-tolerant compare — tenant lookup values are normally trimmed
// slugs, but stay defensive against stray casing/whitespace in stored data.
const norm = (v?: string | null): string => (v ?? '').trim().toLowerCase()

/**
 * Compute the DEFAULT config from the tenant's current phase/status lookups.
 * These are DEFAULTS ONLY (seed-based, regex on value/label) — the tenant's saved
 * `candidate_vacancy_tab` setting, once it exists, always overrides them. This is
 * what a fresh tenant effectively sees before ever opening the settings screen,
 * and what the settings screen shows as its initial (pre-save) state.
 */
export function getVacancyTabDefaults(phases: LookupLike[], statuses: LookupLike[]): Required<VacancyTabConfig> {
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
  return { phases: defaultPhases, hidden_statuses: defaultHiddenStatuses }
}

/**
 * Whether the Vacatures tab should show for this candidate. A key PRESENT in cfg
 * wins ENTIRELY over the default for that key (even an empty array — an explicit
 * "no phases selected" means never show). A phase/status value not present in the
 * tenant's current lookup (renamed/removed — vocabulary drift) always stays
 * visible: it can never have been deliberately unchecked in a settings screen
 * that only renders checkboxes for currently-known lookup values, so hiding it
 * would silently hide data instead of reflecting a real tenant decision.
 */
export function isVacancyTabVisible(
  cfg: VacancyTabConfig | null | undefined,
  candidate: { phase?: string | null; status?: string | null },
  phases: LookupLike[],
  statuses: LookupLike[],
): boolean {
  const defaults = getVacancyTabDefaults(phases, statuses)
  const allowedPhases = cfg?.phases ?? defaults.phases
  const hiddenStatuses = cfg?.hidden_statuses ?? defaults.hidden_statuses

  const phase = norm(candidate.phase)
  const phaseKnown = phases.some(p => norm(p.value) === phase)
  const phaseOk = !phase || !phaseKnown || allowedPhases.some(v => norm(v) === phase)

  const status = norm(candidate.status)
  const statusOk = !status || !hiddenStatuses.some(v => norm(v) === status)

  return phaseOk && statusOk
}
