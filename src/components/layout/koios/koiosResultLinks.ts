/**
 * koiosResultLinks — type → page mapping for the Job 3 result-card deep links.
 * Mirrors the existing cross-entity navigation pattern (NavigationContext's
 * `openEntity(page, id)` + useDrawerUrl's `?open=<id>`, the same one
 * components/ui/EntityLink already uses) — never a second navigation mechanism.
 * Only the types whose page actually exists get a mapping (KOIOS-AGENT-PLAN
 * §7 Job 3: candidates/vacancies/customers/applications/matches/opportunities/
 * tasks/outreach/aiagents); a ref of any other type still renders as a card —
 * just non-clickable, same degrade-safely rule as EntityLink.
 * KOIOS-RESULT-CARDS-6-FE-1 (WORKLIST): `calllist` (campaign id) → outreach,
 * `workflow` → the AI & Workflows page. `appointment`/`note`/`document` are
 * CHILD refs (they carry a `parent:{type,id}` instead of their own page) and
 * route through their PARENT's page + drawer sub-tab via CHILD_REF_TAB below —
 * never a route of their own.
 */
export const RESULT_REF_PAGE: Record<string, string> = {
  candidate: 'candidates',
  vacancy: 'vacancies',
  customer: 'customers',
  application: 'applications',
  match: 'matches',
  opportunity: 'opportunities',
  task: 'tasks',
  outreach_campaign: 'outreach',
  workflow: 'aiagents',
}

// Alias ref types that share another type's page. Kept OUT of RESULT_REF_PAGE:
// koiosAmbientContext INVERTS that table to derive the wire type per page, and
// an alias entry there would hijack the canonical type (outreach_campaign).
const RESULT_REF_ALIAS: Record<string, string> = {
  calllist: 'outreach',
}

// Resolves a Koios result's entity type to the page route it deep-links to; an unknown type yields no link at all.
export function pageForResultRef(type: string): string | null {
  return RESULT_REF_PAGE[type] ?? RESULT_REF_ALIAS[type] ?? null
}

/**
 * CHILD_REF_TAB — for a child ref (appointment/note/document) the drawer sub-tab
 * to open on its PARENT record's page, keyed by [childType][parentType]. Each row
 * was MEASURED against the parent Drawer's own tab list (id names, not guesses):
 *   - candidate (CandidateDrawer.tsx):  planning · communication · documents
 *   - customer  (CustomerDrawer.tsx):   planning · communication · documents
 *   - vacancy   (VacancyDrawer.tsx):    appointments · notes · documents
 *   - application (ApplicationDrawer.tsx TAB_IDS): appointments · notes · (no documents tab)
 *   - opportunity (OpportunityDrawer.tsx): (no appointments tab) · notes · (no documents tab)
 *   - calllist/outreach_campaign (OutreachDrawer.tsx): no appointment/note/document tab at all
 * A parent type with no entry for a given child type has no matching drawer tab —
 * the card routes to the parent WITHOUT a tab param (honest skip, not a guess).
 */
const CHILD_REF_TAB: Record<string, Record<string, string>> = {
  appointment: { candidate: 'planning', customer: 'planning', vacancy: 'appointments', application: 'appointments' },
  note: { candidate: 'communication', customer: 'communication', vacancy: 'notes', application: 'notes', opportunity: 'notes' },
  document: { candidate: 'documents', customer: 'documents', vacancy: 'documents' },
}

// Resolves the drawer sub-tab a child ref's parent should open on; undefined when that parent has no matching tab.
export function tabForChildRef(childType: string, parentType: string): string | undefined {
  return CHILD_REF_TAB[childType]?.[parentType]
}
