/**
 * drillTranslate — the ONE measured seam between K-173 drill descriptors and the
 * destination pages. The server speaks its own list-filter vocabulary
 * (`{ entity: 'candidates', params: { stale_6m: 1, owner_id } }`,
 * DashboardService::drills), the pages speak their intent vocabulary
 * (`('candidates', { attention: 'stale6m', owner })`) — the seam that feeds each
 * page's REAL request builder (useCandidateFilters etc.). Passing raw server
 * params into an intent prop silently drops every filter (Opus K2-slotgolf B1),
 * so this table translates them explicitly, measured per page:
 *   candidates    → CandidatesPage intent effect (attention/status/owner/funnel/location)
 *   tasks         → TasksPage intent (kpi/status/priority/type/assignee)
 *   applications  → ApplicationsPage intent (stage/vacancy/attention)
 *   opportunities → OpportunitiesPage intent (stage/kpi)
 *   conversations → WhatsAppPage intent (tab)
 * A descriptor with ANY param this table cannot express returns null — the tile
 * then keeps its legacy intent (a working, possibly broader drill) instead of a
 * silently unfiltered list. Tile↔list parity is only ever CLAIMED when every
 * param survives translation.
 */

import type { DashDrillDescriptor } from '@/types/dashboard'

export interface TranslatedDrill { page: string; intent: Record<string, unknown> }

// Per-entity: FE page key + per-param translators. A translator returns the
// intent fragment for that param, or null when the page cannot express it.
type ParamTranslator = (value: unknown) => Record<string, unknown> | null

const one = (fragment: Record<string, unknown>): ParamTranslator =>
  v => (v === 1 || v === '1' || v === true ? fragment : null)

const ENTITY_PAGES: Record<string, { page: string; params: Record<string, ParamTranslator> }> = {
  candidates: {
    page: 'candidates',
    params: {
      stale_6m:             one({ attention: 'stale6m' }),
      never_contacted:      one({ attention: 'neverContacted' }),
      no_followup:          one({ attention: 'noFollowup' }),
      intake_planned:       one({ attention: 'intakePlanned' }),
      has_open_tasks:       one({ attention: 'hasTasks' }),
      active_conversations: one({ attention: 'activeConv' }),
      // missing_documents is a NEW server list filter (K-173) with no page
      // intent yet — deliberately absent, so that descriptor falls back.
      owner_id:    v => ({ owner: v }),
      location_id: v => ({ location: v }),
      branch_id:   v => ({ location: v }),
    },
  },
  tasks: {
    page: 'tasks',
    params: {
      open:        one({ kpi: 'open' }),
      overdue:     one({ kpi: 'overdue' }),
      assignee_id: v => ({ assignee: v }),
    },
  },
  applications: {
    page: 'applications',
    params: {
      too_long_in_stage:   one({ attention: 'tooLongInStage' }),
      missing_appointment: one({ attention: 'missingAppointment' }),
      // candidate_owner_id has no ApplicationsPage intent — untranslatable.
    },
  },
  opportunities: {
    page: 'opportunities',
    params: { expiring: one({ kpi: 'expiring' }) },
  },
  conversations: {
    page: 'whatsapp',
    params: { active: one({ tab: 'messages' }) },
  },
  // Entities with a same-named page and (today) no translatable params beyond
  // an empty set: matches/vacancies drills with params translate only when empty.
  matches:   { page: 'matches',   params: {} },
  vacancies: { page: 'vacancies', params: {} },
  // workflow-runs / external-id-mapping-failures have no FE page (yet) — absent
  // here on purpose: their tiles keep the legacy intent, never a PlaceholderPage.
}

/**
 * Translate a server drill descriptor to a page navigation, or null when any
 * part of it cannot be expressed — the caller then uses the tile's legacy intent.
 */
export function translateDrill(d: DashDrillDescriptor): TranslatedDrill | null {
  const entry = ENTITY_PAGES[d.entity]
  if (!entry) return null
  const intent: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(d.params ?? {})) {
    const tr = entry.params[key]
    if (!tr) return null
    const fragment = tr(value)
    if (!fragment) return null
    Object.assign(intent, fragment)
  }
  return { page: entry.page, intent }
}
