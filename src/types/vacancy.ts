/**
 * Vacancy shapes — the UI models (`Vacancy` for the list, `VacancyDetail` for the
 * drawer) and the raw API record (`ApiVacancy`), read defensively by
 * mapVacancy / mapVacancyDetail (the /vacancies endpoint is still settling).
 */
import type { Id, Loose } from './common'

/** VACANCY-LEADS-COUNT-1: provenance of `leadsCount` — the 15-min/nightly worker's
 * last run + why the number might not fully reflect reality right now. */
export interface MatchCountState {
  computedAt: string | null
  isStale: boolean
  geoMissing: boolean
  partial: boolean
}

/** Owner/recruiter chip on a vacancy row. */
export interface VacancyOwner {
  id: Id | null
  name: string
  initials: string
  color: string | null
}

/** A raw job-board channel item (used by base + detail). */
export interface ApiChannel {
  value?: string | number
  // CHANNEL-ICON-1: the stable machine key + icon name so the FE maps publish
  // icons exactly (channelIcons.ts), never a heuristic on the editable label.
  key?: string | number
  icon?: string
  id?: Id
  label?: string
  name?: string
  published?: unknown
}

/** The flat vacancy model rendered by the list/table. */
export interface Vacancy {
  id: Id | undefined
  code: string
  // NUMMER-1: human-readable reference number (V-12) — distinct from the manual `code`.
  referenceNumber?: string
  // ONTKOPPEL-TELLER-1: how many of this vacancy's applications are CURRENTLY
  // detached (soft-deleted, not restored) — the whole-history total, never a
  // filtered-window count. 0/undefined when nothing is detached.
  detachedCount?: number
  title: string
  statusValue: string | number | null
  statusLabel: string
  statusColor: string
  // VACANCY-LEADS-COUNT-1: `null` means "not yet computed by the backend" — the
  // mapper never fabricates a 0 or reads the seeded-random legacy field, so the
  // UI must render an honest "unknown" state instead of treating null as zero.
  leadsCount: number | null
  // VACANCY-LEADS-COUNT-1 (2026-07-27): the count's provenance — null until the
  // engine has ever run for this vacancy. When present, tells whether the shown
  // number is stale/geo-incomplete/partial so the UI never presents a derived
  // number as more certain than it is.
  matchCountState?: MatchCountState | null
  applicationsCount: number
  applicationsByPhase: Loose
  // V-table-2: matches this vacancy has (VacancyListResource.php always emits a
  // real int, never null — a Match is the continuation of a Hired application).
  matchesCount: number
  published: boolean
  // ISO moment of publication; null when never published (stale clock = publishedAt ?? created).
  publishedAt?: string | null
  publishedChannels: unknown[]
  owner: VacancyOwner
  clientId: Id | null
  clientName: string
  tags: unknown[]
  created: string
  createdSort: string
  // City + STRAAL-1 geo: the map view plots list rows (null until the API sends them).
  city: string
  lat: number | null
  lng: number | null
  distanceKm: number | null
  // VAC-DATES-1: the vacancy's own runtime window (YYYY-MM-DD, native <input type="date">
  // shape) — present on both the list AND detail resource, so it lives on the base row.
  startDate: string
  endDate: string
  // Archive state (soft-delete) — mirrors the candidate's archived/archivedAt pair so
  // the table can render the same soft "Gearchiveerd" chip when include_archived=1.
  archived: boolean
  archivedAt: string | null
  // TRASH-OVERAL-2 lifecycle: 'active' | 'archived' | 'pending_erase' (trash) —
  // drives the Gearchiveerd/Prullenbak view split, mirrors Candidate.lifecycle.
  lifecycle: string
  pendingEraseAt: string | null
  // VAC-AGENT-1: the AI agent linked to this vacancy (Option A — linking an agent
  // IS the interview on/off switch; it carries its own interview flow, so only the
  // flow's id rides along too, never a duplicate flow picker on the vacancy itself).
  aiAgentId: Id | null
  aiAgentName: string
  interviewFlowId: Id | null
  // INTERVIEW-WORKFLOW-1 (Appendix D/E): the vacancy's linked interview WORKFLOW —
  // a higher-level replacement for the agent+flow pair above, resolved server-side.
  // `null` = no workflow linked; the picker only goes LIVE once the loaded resource
  // carries the `interview_workflow_id` key at all (see `hasInterviewWorkflowField`
  // below) — a tenant/backend not yet on this contract never sees a broken picker.
  interviewWorkflowId: Id | null
  interviewWorkflow: InterviewWorkflowRef | null
  // Presence gate (§3 no fake affordances): true only when the raw API record
  // literally carried the `interview_workflow_id` key — never inferred from the
  // value itself (a real `null` still counts as "carries the key").
  hasInterviewWorkflowField: boolean
}

/** A resolved interview-workflow reference, as nested on a vacancy/application. */
export interface InterviewWorkflowRef {
  id: Id
  name: string
  folder: { id: Id; name: string } | null
  agent: { id: Id; name: string } | null
}

/**
 * One merged timeline event on a vacancy (V21-23). The backend
 * (VacancyTimeline.php) emits notes, applications received and matches made,
 * each with a COMPOSITE id (`note-<uuid>` / `application-<uuid>` /
 * `match-<uuid>`) and no explicit link target — `linkPage`/`linkId` are the
 * frontend's resolved target (see resolveTimelineLink in data/mapVacancy.ts),
 * null when the event kind has no own record page (notes).
 */
export interface VacancyTimelineEvent {
  id: Id | undefined
  // Event kind as sent by the backend: 'note' | 'application' | 'match' (open-ended on purpose).
  type: string
  author: string
  initials: string
  description: string
  ai: boolean
  time: string
  // Resolved in-app link target; both null when the event is not linkable.
  linkPage: string | null
  linkId: string | null
}

/** The enriched vacancy model rendered by the drawer tabs. */
export interface VacancyDetail extends Vacancy {
  // Raw lookup slugs, so the Details tab can edit in-place (bind a select to the
  // value, resolve the label for read mode). Display labels (seniority/education)
  // stay for the read view.
  seniorityValue: string
  educationValue: string
  // Contract forms this vacancy offers — same lookup as the candidate (multi-value).
  contractTypes: string[]
  // VACANCY-CONTRACT-FIELD-1: the vacancy's own SINGULAR contract-kind/CAO slugs
  // (Voorwaarden sub-tab) — a separate pair of columns from the multi-value
  // `contractTypes` above; same lookup vocabulary as the match's own fields
  // (contract_types.value / collective_labour_agreements.value), resolved to a
  // display label client-side (mirrors how `contractTypes` above is resolved).
  contractType: string
  cao: string
  // Structured address (edited as separate fields, shown as one composed line).
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  province: string
  // VAC-COUNTRY-1 (Danny 22-07, punt 2): land→provincie cascade, mirroring the
  // candidate's address country — an ISO-3166 code, resolved to a display name
  // via getCountryName (never a tenant lookup, same as the candidate's country).
  country: string
  // Experience range in years (from–to).
  experienceMin: string
  experienceMax: string
  salaryMin: string
  salaryMax: string
  hoursMin: string
  hoursMax: string
  location: string
  salary: string
  hours: string
  experience: string
  seniority: string
  education: string
  industry: string
  category: string
  skills: unknown[]
  description: string
  applicationSettings: Loose
  matchWeights: Loose
  // MATCH-TEMPLATE-1: provenance only — which template these weights were last
  // snapshotted from (null = never assigned / cleared by a manual override).
  matchWeightTemplateId: string | null
  // VAC-CASCADE-1: klant → locatie → afdeling → contactpersoon — ids for the in-place
  // editor's pickers, resolved display names for read-mode (seeded from the detail so
  // a saved pick still shows after a reload, and cancel reverts to these).
  customerLocationId: string
  customerLocationName: string
  customerDepartmentId: string
  customerDepartmentName: string
  contactId: string
  contactName: string
  // SWEEP-VESTIGING: the vacancy's OWN bureau branch ("vestiging", FK location_id)
  // — a DIFFERENT concept from customerLocationId above (the KLANT's own site
  // picked via the cascade). Read-only display for now (DetailsLocationTab);
  // mirrors AddVacancyModal's PlacementCard branch picker, which POSTs the same
  // `location_id` key VacancyWriter's scalar passthrough already accepts.
  branchId: string
  branchName: string
  channels: Array<{ value: string | number | undefined; label: string; published: boolean; key?: string; icon?: string }>
  applications: Array<{
    id: Id | undefined; candidateId: Id | null; candidateName: string; candidateInitials: string
    phaseValue: string | number | null; phaseLabel: string; phaseColor: string; source: string; created: string
  }>
  customFields: Array<{ id: Id | undefined; name: string; value: unknown }>
  // Per-vacancy custom-field values keyed by field key (for the Extra tab).
  customFieldValues: Record<string, unknown>
  documents: Array<{ id: Id | undefined; name: string; size: unknown }>
  timeline: VacancyTimelineEvent[]
  // `type` carries the note-category slug (NOTE-TYPES-2, VACANCY-NOTE-TYPE-1) —
  // optional so an older/untyped note (created before the column landed) still renders.
  notes: Array<{ id: Id | undefined; author: string; text: string; time: string; type?: string }>
}

/** Raw API vacancy record (read defensively). */
export interface ApiVacancy {
  id?: Id
  code?: string
  reference?: string
  // NUMMER-1: server-assigned human-readable reference number (V-12).
  reference_number?: string
  title?: string
  status?: { value?: string | number; label?: string; color?: string } | string
  // STRAAL-1: geocoded coordinates + radius distance from the server.
  lat?: number; lng?: number; distance_km?: number
  status_value?: string | number
  status_label?: string
  status_color?: string
  // G39 (08-08): the legacy seeded-random `leads_count` (+ its camelCase alias) is
  // GONE from this type — the mapper never read it (both seeders filled it with
  // random_int(0,25), never a real computation) and CMBE drops the backend emit +
  // column now that this declaration no longer invites a read.
  // VACANCY-LEADS-COUNT-1: the real match-count field, emitted once ticket
  // VACANCY-LEADS-COUNT-1 lands backend-side — the only field the mapper reads.
  candidate_match_count?: number
  // V-table-2: real match count (VacancyListResource.php:54, always an int, never null).
  matches_count?: number
  // VACANCY-LEADS-COUNT-1: the count's provenance, event-driven (15-min worker +
  // nightly full run) — null when the count itself has never been computed.
  match_count_state?: {
    computed_at?: string | null
    is_stale?: unknown
    geo_missing?: unknown
    partial?: unknown
  } | null
  applications_count?: number
  applicationsCount?: number
  applications_by_phase?: Loose
  applicationsByPhase?: Loose
  published?: unknown
  published_channels?: ApiChannel[]
  publishedChannels?: ApiChannel[]
  owner?: { id?: Id; name?: string; avatar_color?: string | null; color?: string | null }
  owner_id?: Id
  owner_name?: string
  customer?: { id?: Id; name?: string }
  client?: { id?: Id; name?: string }
  customer_id?: Id
  client_id?: Id
  customer_name?: string
  client_name?: string
  // VAC-AGENT-1: the linked AI agent (list + detail both carry it) + the flow id
  // that agent brings along — read from either the nested object or a flat id.
  ai_agent?: { id?: Id; name?: string } | null
  ai_agent_id?: Id | null
  interview_flow_id?: Id | null
  // INTERVIEW-WORKFLOW-1: optional on purpose — a tenant/backend not yet on this
  // contract omits the key entirely, which is exactly the presence-gate signal
  // mapVacancy reads (`'interview_workflow_id' in raw`).
  interview_workflow_id?: Id | null
  interview_workflow?: {
    id?: Id; name?: string
    folder?: { id?: Id; name?: string } | null
    agent?: { id?: Id; name?: string } | null
  } | null
  tags?: unknown[]
  created_at?: string
  createdAt?: string
  // VAC-DATES-1: the vacancy's own runtime window (both list + detail resources).
  start_date?: string | null
  end_date?: string | null
  // Archive state (soft-delete) — VacancyListResource always sends both.
  archived?: boolean
  deleted_at?: string | null
  // TRASH-OVERAL-2: the two-step trash lifecycle fields the list resource now
  // carries ('active'|'archived'|'pending_erase' + ISO stamp).
  lifecycle?: string
  pending_erase_at?: string | null
  // detail
  employment_type?: unknown
  employment_type_label?: string
  contract_types?: string[]
  // VACANCY-CONTRACT-FIELD-1: singular contract-kind/CAO slugs (see VacancyDetail).
  contract_type?: string | null
  cao?: string | null
  street?: string
  house_number?: string
  house_number_suffix?: string
  postcode?: string
  postal_code?: string
  city?: string
  province?: string
  // VAC-COUNTRY-1: the DB column is `location_province`/`location_country`
  // (create_vacancy_table r131-132); the internal VacancyDetailResource already
  // maps `location_province` onto the `province` key above, but does not (yet)
  // send `location_country` or `country` — both are read defensively so a future
  // backend addition of either key is picked up with no FE change.
  location_province?: string
  location_country?: string
  country?: string
  experience_min_years?: number | string | null
  experience_max_years?: number | string | null
  location?: string
  salary?: string
  salary_min?: number | string | null
  salary_max?: number | string | null
  salary_period?: string
  hours?: string
  hours_min?: number | string | null
  hours_max?: number | string | null
  hours_unit?: string
  experience?: string
  experience_years?: number | null
  seniority?: unknown
  seniority_label?: string
  education?: unknown
  education_label?: string
  industry?: unknown
  industry_label?: string
  function?: unknown
  category?: string
  function_title?: string
  skills?: unknown[]
  description?: string
  application_settings?: Loose
  match_weights?: Loose
  // MATCH-TEMPLATE-1: which template the current match_weights snapshot came from.
  match_weight_template_id?: string | null
  channels?: ApiChannel[]
  applications?: Array<{
    id?: Id; candidate?: { id?: Id; name?: string; initials?: string }; candidate_name?: string; candidate_id?: Id
    phase?: { value?: string | number; label?: string; color?: string }; phase_key?: string; stage?: string
    phase_label?: string; phase_color?: string; source?: string; created_at?: string
  }>
  custom_fields?: Array<{ id?: Id; name?: string; label?: string; value?: unknown }>
  documents?: Array<{ id?: Id; name?: string; size?: unknown }>
  // V21-23: `type` is the event kind the aggregator sends alongside the composite id.
  timeline?: Array<{ id?: Id; type?: string; author?: string; author_initials?: string; description?: string; ai?: unknown; created_at?: string; time?: string }>
  notes?: Array<{ id?: Id; author?: string; text?: string; body?: string; type?: string; created_at?: string }>
  // VAC-CASCADE-1: klant → locatie → afdeling → contactpersoon — ids + resolved {id,name}.
  customer_location_id?: Id
  customer_location?: { id?: Id; name?: string } | null
  customer_department_id?: Id
  customer_department?: { id?: Id; name?: string } | null
  contact_id?: Id
  contact?: { id?: Id; name?: string } | null
  // SWEEP-VESTIGING (VAC-NEST-1): the vacancy's own bureau branch ("vestiging")
  // — VacancyDetailResource sends the raw FK (`location_id`) AND the resolved
  // {id,name} separately as `branch` (its magic `location` property collides
  // with the free-text address column of the same name on this model).
  location_id?: Id | null
  branch?: { id?: Id; name?: string } | null
  [k: string]: unknown
}
