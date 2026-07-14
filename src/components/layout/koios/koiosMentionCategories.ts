/**
 * koiosMentionCategories — the "@" category list (order fixed by Danny 13/7):
 * Kandidaten · Leads · Sollicitaties · Vacatures · Matches · Kansen · Taken ·
 * Bellijsten · Klanten · Locaties · Afdelingen · Contactpersonen · AI & Workflows
 * · WhatsApp.
 *
 * `labelKey` reuses the sidebar's own nav.* key wherever one exists (Sidebar.jsx
 * NAV_ITEMS) so the mention menu never drifts from the nav labels; entries with
 * no nav equivalent get a dedicated koios.mention.* key, translated in all 5
 * shipped locales (§5).
 *
 * `countKey` names the field of KoiosMentionCounts that feeds this entry's desc
 * line (unchanged, useKoiosMentionCounts).
 *
 * `search` (KOIOS-SEARCH-1, generalized from the candidates-only pilot) wires the
 * SAME list endpoint the entity's own page already searches with — measured
 * against the api repo's routes + controllers, never invented:
 *   - `param`: the query-string key the endpoint's search actually reads
 *     ('search' on candidates/applications/vacancies/matches/opportunities/
 *     customers/workflows/conversations; 'q' on the tasks/outreach/departments/
 *     contacts "picker" endpoints) — using the wrong key silently returns the
 *     unfiltered list, so this is deliberately explicit per category.
 *   - `permission`: the Spatie permission gating the mirror HTTP route
 *     (`*.view`); `pageGate` is used instead for the two categories that are
 *     gated by page/module access rather than a view-permission (aiagents,
 *     whatsapp — see lib/access.ts canAccessPage).
 *   - `refType`: the token attached to the outgoing context ref
 *     (`{type, id}`). Only 'candidate' resolves server-side today
 *     (ContextRefResolver::TYPES, app/KoiosAi/Context/ContextRefResolver.php) —
 *     see koiosContextTypes.ts for the client-side pin fallback for the rest.
 *   - `extraParams`: fixed filters beyond the free-text query (leads = candidates
 *     with no lifecycle status yet, PHASE-FILTER-1).
 *   - `present`: maps one list row to { id, name, subtitle } — the subtitle is
 *     whatever the list payload already carries cheaply (no extra request).
 * `locations` (customer sites) has NO global, tenant-wide list/search endpoint
 * today — only nested under a customer (`/customers/{id}/locations`) — so
 * `search` is omitted; the category still shows (plain "@Locaties " insert,
 * unchanged legacy behaviour) but never attempts a live list (MEASURED gap,
 * see the fase-1 report).
 */
type Row = Record<string, unknown>
const str = (r: Row, key: string): string => (typeof r[key] === 'string' ? (r[key] as string) : '')
const nested = (r: Row, path: string[]): string => {
  let cur: unknown = r
  for (const p of path) cur = cur && typeof cur === 'object' ? (cur as Row)[p] : undefined
  return typeof cur === 'string' ? cur : ''
}

export interface EntitySearchConfig {
  endpoint: string
  param: 'search' | 'q'
  permission?: string
  pageGate?: string
  refType: string
  extraParams?: Record<string, unknown>
  present: (row: Row) => { id: string; name: string; subtitle?: string }
}

export interface MentionCategoryConfig {
  id: string
  labelKey: string
  countKey?: string
  search?: EntitySearchConfig
}

const id = (r: Row) => String(r.id ?? '')

export const MENTION_CATEGORIES: MentionCategoryConfig[] = [
  { id: 'candidates', labelKey: 'nav.candidates', countKey: 'candidates', search: {
    endpoint: '/candidates', param: 'search', permission: 'candidates.view', refType: 'candidate',
    present: (r) => ({ id: id(r), name: str(r, 'name') || '?', subtitle: str(r, 'function_title') }),
  } },
  { id: 'leads', labelKey: 'koios.mention.leads', countKey: 'leads', search: {
    endpoint: '/candidates', param: 'search', permission: 'candidates.view', refType: 'candidate',
    extraParams: { phase: ['lead'] },
    present: (r) => ({ id: id(r), name: str(r, 'name') || '?', subtitle: str(r, 'function_title') }),
  } },
  { id: 'applications', labelKey: 'nav.applications', countKey: 'applications', search: {
    endpoint: '/applications', param: 'search', permission: 'applications.view', refType: 'application',
    present: (r) => ({ id: id(r), name: nested(r, ['candidate', 'name']) || '?', subtitle: nested(r, ['vacancy', 'title']) || str(r, 'phase_label') }),
  } },
  { id: 'vacancies', labelKey: 'nav.vacancies', countKey: 'vacancies', search: {
    endpoint: '/vacancies', param: 'search', permission: 'vacancies.view', refType: 'vacancy',
    present: (r) => ({ id: id(r), name: str(r, 'title') || '?', subtitle: nested(r, ['customer', 'name']) || nested(r, ['status', 'label']) }),
  } },
  { id: 'matches', labelKey: 'nav.matches', countKey: 'matches', search: {
    endpoint: '/matches', param: 'search', permission: 'matches.view', refType: 'match',
    present: (r) => ({ id: id(r), name: nested(r, ['candidate', 'name']) || '?', subtitle: nested(r, ['vacancy', 'title']) }),
  } },
  { id: 'opportunities', labelKey: 'nav.opportunities', countKey: 'opportunities', search: {
    endpoint: '/opportunities', param: 'search', permission: 'opportunities.view', refType: 'opportunity',
    present: (r) => ({ id: id(r), name: str(r, 'title') || '?', subtitle: nested(r, ['customer', 'name']) || nested(r, ['stage', 'label']) }),
  } },
  { id: 'tasks', labelKey: 'nav.tasks', countKey: 'tasks', search: {
    endpoint: '/tasks', param: 'q', permission: 'tasks.view', refType: 'task',
    present: (r) => ({ id: id(r), name: str(r, 'title') || '?', subtitle: nested(r, ['status', 'label']) }),
  } },
  { id: 'outreach', labelKey: 'nav.outreach', countKey: 'outreach', search: {
    endpoint: '/outreach-campaigns', param: 'q', permission: 'outreach.view', refType: 'outreach_campaign',
    present: (r) => ({ id: id(r), name: str(r, 'name') || '?', subtitle: str(r, 'status') }),
  } },
  { id: 'customers', labelKey: 'nav.customers', countKey: 'customers', search: {
    endpoint: '/customers', param: 'search', permission: 'customers.view', refType: 'customer',
    present: (r) => ({ id: id(r), name: str(r, 'name') || '?', subtitle: str(r, 'city') }),
  } },
  { id: 'locations', labelKey: 'koios.mention.locations' }, // MEASURED: no global list endpoint yet.
  { id: 'departments', labelKey: 'koios.mention.departments', search: {
    endpoint: '/departments', param: 'q', permission: 'customers.view', refType: 'department',
    present: (r) => ({ id: id(r), name: str(r, 'name') || '?', subtitle: str(r, 'customer_name') }),
  } },
  { id: 'contacts', labelKey: 'koios.mention.contacts', search: {
    endpoint: '/contacts', param: 'q', permission: 'customers.view', refType: 'contact',
    present: (r) => ({ id: id(r), name: str(r, 'name') || '?', subtitle: str(r, 'customer_name') }),
  } },
  { id: 'aiagents', labelKey: 'nav.aiagents', search: {
    endpoint: '/workflows', param: 'search', pageGate: 'aiagents', refType: 'workflow',
    present: (r) => ({ id: id(r), name: str(r, 'name') || '?', subtitle: str(r, 'trigger') }),
  } },
  { id: 'whatsapp', labelKey: 'nav.whatsapp', search: {
    endpoint: '/conversations', param: 'search', pageGate: 'whatsapp', refType: 'conversation',
    present: (r) => ({ id: id(r), name: nested(r, ['candidate', 'full_name']) || str(r, 'wa_number') || '?', subtitle: str(r, 'wa_number') }),
  } },
]
