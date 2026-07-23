import type {
  ApplyPayload,
  ApplyResponse,
  PaginatedResponse,
  SiteInfo,
  VacancyDetail,
  VacancySummary,
} from './types'

// Public, unauthenticated API client — no cookies/credentials, no bearer token
// (CLAUDE.md §7: this surface never carries session state). Base URL is tenant-scoped:
// {VITE_CAREER_API_URL or a local dev default}/public/{tenant}.
const DEFAULT_API_BASE = 'http://koiosmatch-api.test/api'
const API_BASE = import.meta.env.VITE_CAREER_API_URL ?? DEFAULT_API_BASE

// Thrown for any non-2xx response — carries the HTTP status but never the raw
// server body, so a caller can never accidentally render an unsanitized server message.
export class ApiError extends Error {
  status: number
  constructor(status: number) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

// Builds the tenant-scoped public URL for one path segment.
function publicUrl(tenant: string, path: string): string {
  return `${API_BASE}/public/${encodeURIComponent(tenant)}${path}`
}

// Shared response handling: throws ApiError on failure, otherwise parses JSON.
async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status)
  return (await res.json()) as T
}

// GET /public/{tenant}/site — tenant branding (name, logo, brand color, address).
export async function fetchSite(tenant: string): Promise<SiteInfo> {
  const res = await fetch(publicUrl(tenant, '/site'), { credentials: 'omit' })
  return parseJsonOrThrow<SiteInfo>(res)
}

export interface VacancyListParams {
  page?: number
  per_page?: number
  city?: string
  hours?: number
}

// Builds the query string for the vacancy list — only includes params that are set.
function buildVacancyQuery(params: VacancyListParams): string {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.per_page) query.set('per_page', String(params.per_page))
  if (params.city) query.set('city', params.city)
  if (params.hours) query.set('hours', String(params.hours))
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

// GET /public/{tenant}/vacancies — paginated, filterable list of published vacancies.
export async function fetchVacancies(
  tenant: string,
  params: VacancyListParams = {},
): Promise<PaginatedResponse<VacancySummary>> {
  const res = await fetch(publicUrl(tenant, `/vacancies${buildVacancyQuery(params)}`), {
    credentials: 'omit',
  })
  return parseJsonOrThrow<PaginatedResponse<VacancySummary>>(res)
}

// GET /public/{tenant}/vacancies/{ref} — full detail incl. sanitized HTML + JobPosting JSON-LD.
// The endpoint wraps the record in Laravel's { data: {...} } resource envelope — unwrap it
// (tolerantly, in case the envelope ever disappears). Danny 23-07: the un-unwrapped object
// made every field undefined and the detail page rendered blank.
export async function fetchVacancy(tenant: string, reference: string): Promise<VacancyDetail> {
  const res = await fetch(publicUrl(tenant, `/vacancies/${encodeURIComponent(reference)}`), {
    credentials: 'omit',
  })
  const json = await parseJsonOrThrow<{ data?: VacancyDetail } | VacancyDetail>(res)
  return (json as { data?: VacancyDetail }).data ?? (json as VacancyDetail)
}

// Appends a repeatable entry array as Laravel-style nested keys
// (`experiences[0][company]`, …) — only non-empty scalar fields are sent per
// entry, so an entry's blank optional sub-fields are simply omitted rather
// than sent as explicit blanks. Generic + unconstrained (rather than
// `Record<string, string>`) because ExperienceEntry/EducationEntry are plain
// interfaces with no index signature — TS only allows the Object.entries read
// via an internal cast, not via a Record-typed parameter at the call site.
function appendEntries<T extends object>(formData: FormData, key: string, entries: T[]): void {
  entries.forEach((entry, index) => {
    Object.entries(entry as Record<string, string>).forEach(([field, value]) => {
      if (value) formData.set(`${key}[${index}][${field}]`, value)
    })
  })
}

// Builds the multipart body for an application — the honeypot field is always
// included (empty for real applicants), never logged (CLAUDE.md §8: no PII in logs).
// Every new optional field (address/photo/remarks/experiences/educations) is
// omitted entirely when empty — never sent as a blank string/empty array.
function buildApplyFormData(payload: ApplyPayload): FormData {
  const formData = new FormData()
  formData.set('first_name', payload.first_name)
  formData.set('last_name', payload.last_name)
  formData.set('email', payload.email)
  formData.set('phone', payload.phone)
  if (payload.motivation) formData.set('motivation', payload.motivation)
  if (payload.cv) formData.set('cv', payload.cv)
  if (payload.street) formData.set('street', payload.street)
  if (payload.house_number) formData.set('house_number', payload.house_number)
  if (payload.postcode) formData.set('postcode', payload.postcode)
  if (payload.city) formData.set('city', payload.city)
  if (payload.photo) formData.set('photo', payload.photo)
  if (payload.remarks) formData.set('remarks', payload.remarks)
  appendEntries(formData, 'experiences', payload.experiences ?? [])
  appendEntries(formData, 'educations', payload.educations ?? [])
  formData.set('website', payload.website)
  return formData
}

// POST /public/{tenant}/vacancies/{ref}/apply — multipart submission.
export async function applyToVacancy(
  tenant: string,
  reference: string,
  payload: ApplyPayload,
): Promise<ApplyResponse> {
  const res = await fetch(publicUrl(tenant, `/vacancies/${encodeURIComponent(reference)}/apply`), {
    method: 'POST',
    body: buildApplyFormData(payload),
    credentials: 'omit',
  })
  return parseJsonOrThrow<ApplyResponse>(res)
}
