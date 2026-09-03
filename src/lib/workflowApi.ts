/**
 * workflowApi — base-URL resolver for the workflow-EXECUTION endpoints (runs,
 * run/cancel, logs, queue status). Decision 2026-06-23 (project_workflow_
 * separate_server memory): the workflow engine will move to its own server, so
 * these calls must be redirectable via env var alone, with zero code change,
 * while workflow-DEFINITION CRUD (create/update/delete a workflow) stays on the
 * main API and keeps using the shared `api` client directly.
 *
 * Falls back to VITE_API_URL (same base the main api client uses) when unset,
 * so today — engine and API on one host — behaviour is unchanged.
 *
 * NOT adopted here: `POST /workflows/test-module` (useWorkflowEditor.ts, the
 * per-module "test this step" preview in the canvas editor). That call stays
 * on the main `api` client — it is a synchronous PREVIEW executed by the main
 * API against a single module's config, not a real queued engine run, so it
 * never needs to move with the engine.
 */
export function resolveWorkflowBaseURL(): string {
  // Truthiness (`||`), not `??`: an env var set to the EMPTY string ('') must
  // still fall through to the next candidate — `??` only skips null/undefined
  // and would pin an empty base URL instead of falling back.
  return (
    import.meta.env.VITE_WORKFLOW_API_URL ||
    import.meta.env.VITE_API_URL ||
    'http://koiosmatch-api.test/api'
  )
}
