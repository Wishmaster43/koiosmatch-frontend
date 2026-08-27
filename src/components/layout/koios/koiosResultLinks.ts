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
 * are deliberately left unmapped here — there is no per-record appointment/
 * note/document route today, only a parent-drawer sub-tab the backend does
 * not yet expose consistently enough to route through; honest skip, not an
 * oversight.
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
