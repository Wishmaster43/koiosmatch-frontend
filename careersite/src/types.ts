// Shared response shapes for the public career-site API (CAREER-1 backend contract).
// Hand-written: this is a standalone app with no generated api-generated.ts of its own.

// GET /public/{tenant}/site — always answers (even when the site is off), so the
// public app can render a branded "not available" state instead of a generic error.
export interface SiteInfo {
  tenant: string
  name: string
  brand_color: string | null
  logo_url: string | null
  address: string | null
  // CAREER-SITE-ACTIVE: whether the tenant switched its public career site on
  // (default OFF/opt-in). When false, the data endpoints (vacancies/apply/feeds)
  // 404 — the frontend must gate on this flag rather than treat it as an error.
  active: boolean
}

export interface HoursRange {
  from: number
  to: number
}

export interface SalaryRange {
  from: number
  to: number
  period: string
  currency: string
}

// One row of GET /public/{tenant}/vacancies (list) — also the base of the detail shape.
export interface VacancySummary {
  reference_number: string
  title: string
  city: string
  province: string
  hours: HoursRange
  contract_types: string[]
  salary: SalaryRange | null
  intro: string
  published_at: string
}

// GET /public/{tenant}/vacancies/{ref} — summary fields plus the full detail body.
export interface VacancyDetail extends VacancySummary {
  description: string
  employment_type: string | null
  remote_allowed: boolean
  json_ld: Record<string, unknown>
}

// Laravel's standard paginator envelope.
export interface PaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export interface PaginationLinks {
  first: string | null
  last: string | null
  prev: string | null
  next: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
  links: PaginationLinks
}

// POST /public/{tenant}/vacancies/{ref}/apply — multipart request body.
export interface ApplyPayload {
  first_name: string
  last_name: string
  email: string
  phone: string
  motivation?: string
  cv?: File | null
  // Honeypot — must stay empty; a filled value marks the submission as a bot to the backend.
  website: string
}

export interface ApplyResponse {
  status: 'applied'
  reference: string
}
