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

// One apply-form field's visibility (CareerVacancyDetailResource::applyFormSettings).
export type ApplicationFieldSetting = 'required' | 'optional' | 'hidden'

// Per-vacancy apply-form field visibility (CAREERSITE-APPLY-2). The backend always
// answers with all five keys filled — this type is Partial because the FE tolerates
// a missing object/key too (lib/applySettings.ts fills the documented defaults).
export interface ApplicationSettings {
  cv: ApplicationFieldSetting
  cover_letter: ApplicationFieldSetting
  photo: ApplicationFieldSetting
  remarks: ApplicationFieldSetting
  interview_consent: ApplicationFieldSetting
}

// GET /public/{tenant}/vacancies/{ref} — summary fields plus the full detail body.
export interface VacancyDetail extends VacancySummary {
  description: string
  employment_type: string | null
  remote_allowed: boolean
  // Tolerant: may be missing entirely or miss individual keys on an older response —
  // always read through getApplicationSettings() rather than indexing this directly.
  application_settings?: Partial<ApplicationSettings>
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

// One repeatable work-experience row (CAREERSITE-APPLY-2). Dates are stored as
// full 'YYYY-MM-DD' strings (the <input type="month"> UI normalizes to day 01)
// since that is what the backend's `date` validation rule reliably parses.
export interface ExperienceEntry {
  company: string
  title: string
  location: string
  start_date: string
  end_date: string
  responsibilities: string
  achievements: string
}

// One repeatable education row (CAREERSITE-APPLY-2).
export interface EducationEntry {
  name: string
  organisation: string
  issued_at: string
  license_number: string
}

// POST /public/{tenant}/vacancies/{ref}/apply — multipart request body.
export interface ApplyPayload {
  first_name: string
  last_name: string
  email: string
  phone: string
  motivation?: string
  cv?: File | null
  // Address block (CAREERSITE-APPLY-2) — always optional; the backend only fills
  // BLANK candidate fields, so an empty value is simply omitted, never sent blank.
  street?: string
  house_number?: string
  postcode?: string
  city?: string
  // Profile photo — defaults to hidden (AVG); only sent when the vacancy opted in.
  photo?: File | null
  remarks?: string
  // INTERVIEW-CONSENT-PERSIST-1: the applicant's tick for the (AI-)interview
  // consent — undefined when the vacancy's setting hides the field entirely
  // (never sent, mirrors how photo/remarks stay unset rather than blank).
  interview_consent?: boolean
  experiences?: ExperienceEntry[]
  educations?: EducationEntry[]
  // Honeypot — must stay empty; a filled value marks the submission as a bot to the backend.
  website: string
}

export interface ApplyResponse {
  status: 'applied'
  reference: string
}
