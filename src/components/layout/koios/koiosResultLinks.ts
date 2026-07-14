/**
 * koiosResultLinks — type → page mapping for the Job 3 result-card deep links.
 * Mirrors the existing cross-entity navigation pattern (NavigationContext's
 * `openEntity(page, id)` + useDrawerUrl's `?open=<id>`, the same one
 * components/ui/EntityLink already uses) — never a second navigation mechanism.
 * Only the types whose page actually exists get a mapping (KOIOS-AGENT-PLAN
 * §7 Job 3: candidates/vacancies/customers/applications/matches/opportunities/
 * tasks/outreach); a ref of any other type (department/contact/workflow/
 * conversation) still renders as a card — just non-clickable, same
 * degrade-safely rule as EntityLink.
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
}

export function pageForResultRef(type: string): string | null {
  return RESULT_REF_PAGE[type] ?? null
}
