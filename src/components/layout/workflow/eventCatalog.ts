/**
 * Workflow event-trigger catalogue (BIRTHDAY-FLOW-2). A workflow with
 * `trigger_type: 'event'` fires on a backend domain event carried as
 * `trigger_config.event` (verified against WorkflowDispatcher::dispatch +
 * DispatchBirthdayEvents in koiosmatch-api — the dotted key, e.g.
 * `candidate.birthday`, is what the backend compares literally).
 *
 * There is no `/workflows/events` catalogue endpoint yet (checked
 * WorkflowController + routes/api/tenant/workflows.php, 2026-07-20), so this
 * is a seed fallback — grow it as backend-Claude ships more dispatch points
 * (e.g. application.stage_changed, match.created, match.start already exist
 * as template-only events but are not general-purpose picker options yet).
 */
export const WORKFLOW_EVENT_KEYS = ['candidate.birthday'] as const

export type WorkflowEventKey = (typeof WORKFLOW_EVENT_KEYS)[number]

// i18n keys can't contain the raw dotted event key (react-i18next reads '.'
// as a nesting separator), so the label lookup uses the sanitized form:
// t(`triggers.events.${eventKeyToI18nKey(key)}`) -> triggers.events.candidate_birthday
export function eventKeyToI18nKey(key: string): string {
  return key.replace(/\./g, '_')
}
