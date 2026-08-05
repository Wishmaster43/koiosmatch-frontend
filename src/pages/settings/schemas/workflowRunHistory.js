/**
 * Workflow run-history retention (WF-RUN-PRUNE-1, Danny 2026-08-05) — how many
 * days a completed workflow RUN is kept before the nightly `workflows:prune-runs`
 * command deletes it. Backend: `App\Workflow\RunRetentionSettings` reads the same
 * generic tenant `Setting` row this schema writes (`workflow_run_retention_days`,
 * key already live on the backend) — the tenant may only shorten the platform's
 * 31-day ceiling, never raise it (RunRetentionSettings::MAX_DAYS); the pruner
 * itself always keeps each workflow's single most recent run regardless of age,
 * so this field never risks a workflow reading "never ran".
 */
export default {
  i18nKey: 'workflowRunHistory',
  // Reuse the nav label as the section title (mirrors the kpis.js schemas) —
  // one i18n key instead of a redundant nav.* + workflowRunHistory.title pair.
  titleI18n: 'nav.workflow_run_history',
  fields: [
    { key: 'workflow_run_retention_days', type: 'number', default: 31, min: 1, max: 31 },
  ],
}
