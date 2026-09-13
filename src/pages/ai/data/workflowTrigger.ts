// Workflow-level trigger → i18n key — the workflow's own start condition
// (scheduled/webhook/event/manual), shared by WorkflowCard (label only) and
// WorkflowListRow (label + icon, see its own triggerMeta wrapper).
export function triggerKeyForType(triggerType?: string): string {
  if (triggerType === 'scheduled') return 'list.triggerScheduled'
  if (triggerType === 'webhook') return 'list.triggerWebhook'
  if (triggerType === 'event') return 'list.triggerEvent'
  return 'list.triggerManual'
}
