/**
 * Shared types for the reports area (components/reports). These rows mirror
 * loosely-typed external data (ShiftManager customers/candidates, workflow runs,
 * messages), so each interface declares the fields the reports actually render
 * and keeps a `[key: string]: unknown` index signature for the dynamic,
 * key-based sorting the tables do.
 */
import type { ReactNode } from 'react'

// One selectable value in a report filter group (count shown as a small badge).
export interface FilterOption {
  value: string | number
  label?: string
  count?: number
  // Optional semantic colour (status/funnel lookups) — shown as a soft dot.
  color?: string
}

// A filter group registered for the shared right-hand sidebar. Shape varies by
// `type` (period | global-search | location | date-range | search-select |
// radio | default checkbox); every variant field is optional and the index
// signature keeps it assignable to the context's generic FilterGroup.
export interface ReportFilterGroup {
  key: string
  label?: string
  category?: string
  type?: string
  options?: FilterOption[]
  selected?: Array<string | number>
  onToggle?: (value: string | number) => void
  value?: string
  onChange?: (value: string) => void
  years?: number[]
  city?: string
  radius?: string
  onCityChange?: (value: string) => void
  onRadiusChange?: (value: string) => void
  from?: string
  to?: string
  onFromChange?: (value: string) => void
  onToChange?: (value: string) => void
  placeholder?: string
  // 'open' renders the options as an always-visible checkbox list (small fixed
  // lookups); default keeps the collapsed searchable dropdown (long lists).
  display?: 'open' | 'dropdown'
  // geo-radius group (place/postcode + km → server-side lat/lng/radius filter).
  applied?: { label: string } | null
  hint?: string | null
  km?: number
  onApply?: (query: string, km: number) => void
  onClear?: () => void
  // Optional default-collapse override for the right filter panel (punt 31) —
  // omit it and the panel picks a sensible default (first ~4 groups open).
  collapsed?: boolean
  [key: string]: unknown
}

// Per-step result inside a workflow run. `input`/`output` are the raw data
// bundles the step received and produced (shown expandable in the run drawer).
export interface RunStep {
  // WF-R3 live-run fields (present on runs from the queued engine).
  step_id?: string | number
  step_order?: number
  module_type?: string
  started_at?: string | null
  finished_at?: string | null
  summary?: string
  items?: number
  // Router step: the per-route distribution (Fase 2) — "→ Dagdienst: 12/40".
  routing?: Array<{ to_label?: string; matched?: number; total?: number; filtered?: number }>
  // NODE-PROGRESS-1: live loop progress ({done,total}) for the canvas node ring;
  // null/absent = atomic step (the node shows an indeterminate spinner instead).
  progress?: { done: number; total: number } | null
  items_total?: number | null
  attempts?: number
  error?: string | null
  error_message?: string | null
  next_attempt_at?: string | null
  label?: string
  type?: string
  status?: string
  ok?: boolean
  message?: string
  input?: unknown
  output?: unknown
  duration_ms?: number
  operations?: number
  [key: string]: unknown
}

// One workflow run (execution) row.
export interface RunRow {
  id?: string | number
  workflow_id?: string | number
  workflow_name?: string
  status?: string
  started_at?: string
  created_at?: string
  finished_at?: string
  completed_at?: string
  duration_ms?: number
  duration?: number
  candidates_count?: number
  candidates?: number
  trigger?: string
  trigger_type?: string
  triggered_by?: string
  user_name?: string
  // WF-LOG-WHO-1: the run's subject candidate (id + display ref + name), when the
  // trigger context carried one (e.g. the PDOK geocode scenario / event runs).
  candidate?: { id?: string; reference_number?: string | null; name?: string | null } | null
  error_message?: string
  step_results?: RunStep[]
  steps?: RunStep[]
  [key: string]: unknown
}

// A candidate's per-step global rate (ShiftManager).
export interface GlobalRate {
  global_rate?: { internal_description?: string }
  step_name?: string
  hour_rate?: number | string | null
  is_default_step?: number
  [key: string]: unknown
}

// A candidate feature/characteristic tag.
export interface CandidateFeature { name?: string; [key: string]: unknown }

// Candidate row used by the candidate report table + drawers (ShiftManager mirror).
export interface ReportCandidate {
  id?: string | number
  firstname?: string
  lastname?: string
  email?: string
  position?: string
  mobile?: string
  phone?: string
  city?: string
  status?: string
  registration_date?: string
  last_login_at?: string
  last_planned_shift?: string
  last_worked_shift?: string
  end_date_employment?: string
  number_of_times_worked?: number
  no_shows?: number
  no_show_count?: number
  cancellations?: number
  features?: CandidateFeature[]
  global_rate_summary?: GlobalRate[]
  [key: string]: unknown
}

// Department row (flattened from customer → location → department).
export interface ReportDepartment {
  id?: string | number
  name?: string
  cost_center?: string
  external_id?: string | number
  remarks?: string
  location_name?: string
  location_id?: string | number
  location_status?: string
  customer_name?: string
  customer_id?: string | number
  [key: string]: unknown
}

// Location row (flattened from customer → location).
export interface ReportLocation {
  id?: string | number
  name?: string
  status?: string
  street?: string
  house_number?: string
  postal_code?: string
  city?: string
  country?: string
  address?: string
  external_id?: string | number
  dept_count?: number
  departments?: ReportDepartment[]
  customer_name?: string
  customer_id?: string | number
  [key: string]: unknown
}

// Contact-person row (flattened from a customer's contacts).
export interface ReportContact {
  id?: string | number
  firstname?: string
  lastname?: string
  email?: string
  mobile?: string
  phone?: string
  function_title?: string
  salutation?: string
  remarks?: string
  scheduled_order_contact?: boolean | number
  customer_name?: string
  customer_id?: string | number
  location_count?: number
  [key: string]: unknown
}

// Customer row + nested locations/contacts.
export interface ReportCustomer {
  id?: string | number
  name?: string
  debtor_number?: string
  status?: string
  account_manager?: string
  external_id?: string | number
  locations?: ReportLocation[]
  contacts?: ReportContact[]
  [key: string]: unknown
}

// Message row (WhatsApp/email) + drawer detail.
export interface MessageRow {
  id?: string | number
  channel?: string
  status?: string
  subject?: string
  template_name?: string
  workflow_name?: string
  recipient_name?: string
  recipient_phone?: string
  recipient_email?: string
  to_phone?: string
  to_email?: string
  sent_at?: string
  created_at?: string
  delivered_at?: string
  read_at?: string
  body?: string
  error_message?: string
  [key: string]: unknown
}

// A sortable, renderable column descriptor for the candidate report table.
export interface ReportColumn {
  key: string
  label: string
  type?: string
  align?: 'left' | 'right'
  value: (c: ReportCandidate) => string | number | null
  render: (c: ReportCandidate) => ReactNode
}

// Sort state shared by the report tables.
export interface SortState { key: string; dir: 'asc' | 'desc' }
