/**
 * taskLinkTypes — the ONE task-link vocabulary (§11 one source). Was a private
 * const inside `drawer/LinksTab.tsx`; lifted here the moment a SECOND surface
 * needed it (Danny 08-08 punt 15: "een nieuwe taak moet ook aan een bedrijf,
 * locatie, afdeling of contactpersoon kunnen hangen" — the CREATE form now
 * offers the same couplings as the drawer tab, from this same table, never a
 * second hand-kept list that drifts).
 *
 * MEASURED against the backend (14-08, final vocabulary): `TaskLinkResolver::MODELS`
 * declares FOURTEEN tokens — candidate · application · vacancy · match · customer
 * · opportunity · location · customer_location · department · contact · workflow ·
 * outreach_campaign · conversation · task — and both StoreTaskRequest and
 * UpdateTaskRequest validate `links.*.type` with `Rule::in(TaskLinkResolver::types())`.
 * A live `POST /tasks` with `{type:'department'}`, `{type:'location'}` and
 * `{type:'opportunity'}` came back 201 with all three links labelled, so every
 * token offered below is a real, round-tripping coupling.
 *
 * DEDUPE (14-08, Danny): `location` = the AGENCY's own branch (GET /locations);
 * `customer_location` = a site BELONGING TO A CUSTOMER (nested under a customer).
 * They read as near-synonyms in Dutch ("Vestiging" vs "Locatie van klant") — never
 * merge their labels or endpoints, and never let one token's picker leak the
 * other's rows.
 *
 * One backend token is deliberately NOT offered (honest gate, §3 — never a picker
 * that cannot fill itself):
 *  - `customer_location`: there is still no global list route (GET
 *    /customer-locations → 404); the rows only exist nested under
 *    GET /customers/{id}/locations, so a tenant-wide picker has nothing to query.
 *    Needs a global route (or a `?customer_id=` filter) before it can join this
 *    table — flagged to backend-Claude, not silently worked around with a picker
 *    that would always come back empty.
 *  - `department` IS offered — /departments is a real global route (it returns
 *    the CUSTOMER's departments incl. `customer_name`, matching the backend's
 *    CustomerDepartment model behind the token).
 *  - `outreach_campaign` (bellijst) → GET /outreach-campaigns, `conversation`
 *    (WhatsApp-gesprek) → GET /conversations, `task` (een andere taak) →
 *    GET /tasks — all three are real, already-used global list routes elsewhere
 *    in the app, so they round-trip the same way the original eleven do.
 */
import type { Id } from '@/types/common'

// The shape the pickers read from each list endpoint (every field optional —
// the endpoints differ, the label function below picks what exists).
export interface LinkRow {
  id?: Id
  name?: string
  first_name?: string
  last_name?: string
  candidate?: { name?: string; first_name?: string; last_name?: string }
  candidateName?: string
  vacancyTitle?: string
  title?: string
  phone_number?: string
  [k: string]: unknown
}

export interface LinkEndpoint {
  // Where to search entities of this type.
  url: string
  // Human label for one row of that endpoint.
  label: (r: LinkRow) => string
}

// "first last" for person-shaped rows, with an id fallback so a label is never blank.
const personName = (r: LinkRow): string => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || `#${r.id}`

// token → how to fetch/label it. Keys must stay inside TaskLinkResolver::types().
export const TASK_LINK_ENDPOINTS: Record<string, LinkEndpoint> = {
  candidate:   { url: '/candidates',    label: personName },
  application: { url: '/applications',  label: r => r.candidate?.name || r.candidateName || r.vacancyTitle || r.title || `#${r.id}` },
  vacancy:     { url: '/vacancies',     label: r => r.title || r.name || `#${r.id}` },
  match:       { url: '/matches',       label: r => r.candidate?.name || r.candidateName || r.title || `#${r.id}` },
  customer:    { url: '/customers',     label: r => r.name || `#${r.id}` },
  opportunity: { url: '/opportunities', label: r => r.title || r.name || `#${r.id}` },
  location:    { url: '/locations',     label: r => r.name || `#${r.id}` },
  department:  { url: '/departments',   label: r => r.name || `#${r.id}` },
  contact:     { url: '/contacts',      label: personName },
  workflow:    { url: '/workflows',     label: r => r.name || `#${r.id}` },
  outreach_campaign: { url: '/outreach-campaigns', label: r => r.name || `#${r.id}` },
  conversation: { url: '/conversations', label: r => {
    const candName = r.candidate ? [r.candidate.first_name, r.candidate.last_name].filter(Boolean).join(' ') : ''
    return candName || r.phone_number || `#${r.id}`
  } },
  task: { url: '/tasks', label: r => r.title || r.name || `#${r.id}` },
}

// Every offered token, in menu order.
export const TASK_LINK_TYPES: string[] = Object.keys(TASK_LINK_ENDPOINTS)

// Link type → the page that honours the { open: id } intent (click-through, Danny
// 2026-07-04). Types without a drill-down surface yet (contact/location/…) render
// as plain text until their page exists (contacts = CUST-3). `opportunity` stays
// OUT on purpose: OpportunitiesPage does not call `useOpenFromIntent`, so a click
// would switch pages without opening the record — a half-affordance (§3).
export const TASK_LINK_PAGE: Record<string, string> = {
  candidate: 'candidates', vacancy: 'vacancies', customer: 'customers', application: 'applications',
}
