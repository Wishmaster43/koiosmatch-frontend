/**
 * vacancyGenerateApi — thin API layer for VACGEN-1 fase 1b: resolve the
 * best-matching generation profile for a vacancy's traits (transparency chip)
 * and generate a CONCEPT vacancy text from it. Hand-written types (§10) — the
 * openapi-typescript spec has no entries yet for these freshly landed routes
 * (backend commit 87b3dd8). Nothing here persists or publishes anything;
 * generate() only returns a concept the caller reviews before applying it
 * through the existing description save path (never a silent overwrite).
 */
import api from '@/lib/api'
import type { VacancyDetail } from '@/types/vacancy'

// Traits the resolver scores a profile against — any subset is fine, a missing
// trait is a wildcard (never blocks a match, never adds specificity either).
export interface GenerationTraits {
  location_id?: string
  contract_type?: string
  function?: string
  industry?: string
}

// The resolved profile — only the fields the read-only transparency chip needs.
export interface ResolvedGenerationProfile {
  profileId: string
  name: string
  specificity: number
  matchedDims: string[]
}

interface ApiResolveResponse {
  profile?: { id?: string; name?: string }
  specificity?: number
  matched_dims?: string[]
}

/**
 * GET /vacancy-generation-profiles/resolve — the best-matching profile for the
 * given traits, or null when the tenant has no generation profile configured at
 * all. A 404 there is the expected "nothing to resolve" outcome, not a real
 * error (quiet404 keeps it out of the dev log, mirroring the 503 convention in
 * lib/api's isServiceUnavailable).
 */
export async function resolveGenerationProfile(traits: GenerationTraits, signal?: AbortSignal): Promise<ResolvedGenerationProfile | null> {
  try {
    const res = await api.get<ApiResolveResponse>('/vacancy-generation-profiles/resolve', { params: traits, signal, quiet404: true })
    const { profile, specificity, matched_dims } = res.data
    if (!profile?.id) return null
    return { profileId: profile.id, name: profile.name ?? '', specificity: specificity ?? 0, matchedDims: matched_dims ?? [] }
  } catch (err) {
    if ((err as { response?: { status?: number } })?.response?.status === 404) return null
    throw err
  }
}

/**
 * The traits sent to the resolver — best-effort dims available on the vacancy
 * record today. There is no stable `location_id` on the vacancy yet (only the
 * customer's own address/location cascade, a different concept), so location
 * stays a wildcard rather than guessing wrong.
 */
export function buildGenerateTraits(vacancy: VacancyDetail): GenerationTraits {
  const traits: GenerationTraits = {}
  if (vacancy.contractTypes?.[0]) traits.contract_type = vacancy.contractTypes[0]
  if (vacancy.category) traits.function = vacancy.category
  if (vacancy.industry) traits.industry = vacancy.industry
  return traits
}

/**
 * The extra `fields` sent alongside `base_vacancy_id` — only neutral job data
 * goes into the prompt (AVG: never candidate/health data). base_vacancy_id
 * already seeds job_title + location server-side (fieldsFromVacancy), so this
 * only adds what that lookup does not cover.
 */
export function buildGenerateFields(vacancy: VacancyDetail): Record<string, string> {
  const fields: Record<string, string> = {}
  if (vacancy.contractTypes?.[0]) fields.contract_form = vacancy.contractTypes[0]
  if (vacancy.industry) fields.industry = vacancy.industry
  if (vacancy.clientName) fields.customer_name = vacancy.clientName
  if (vacancy.hours) fields.hours = vacancy.hours
  if (vacancy.experience) fields.experience = vacancy.experience
  return fields
}

export interface GenerateResult { concept: string; model: string; profileId: string }
interface ApiGenerateSuccess { ok: true; concept: string; model: string; profile_id: string }
interface GeneratePayload { profileId?: string; baseVacancyId?: string; fields: Record<string, string> }

/**
 * POST /vacancies/generate — sync, throttled, returns a CONCEPT (never persists,
 * never publishes). 503 = soft-fail (no AI credit) and 404 = no profile could be
 * resolved — both expected, caller-handled outcomes; quietStatuses keeps the dev
 * console/toast quiet (mirrors the 429/503 conventions already in lib/api). A
 * longer timeout than the 20s default: this is a real Anthropic round-trip, not
 * a CRUD call, and `/vacancies/generate` isn't on the SLOW_PATHS allowlist.
 */
export async function generateVacancyText({ profileId, baseVacancyId, fields }: GeneratePayload, signal?: AbortSignal): Promise<GenerateResult> {
  const res = await api.post<ApiGenerateSuccess>('/vacancies/generate', {
    profile_id: profileId, base_vacancy_id: baseVacancyId, fields,
  }, { signal, timeout: 60000, quietStatuses: [404, 503] })
  return { concept: res.data.concept, model: res.data.model, profileId: res.data.profile_id }
}
