/**
 * shared.ts — the ai/workflows entity's PUBLIC surface (§2 barrel-besluit).
 * Anything another entity/component needs from this feature is re-exported
 * here; a deep import into pages/ai/** from outside this folder is a lint
 * finding. Keep this file THIN — pure re-exports, no logic of its own.
 */
export { useWorkflowQueueBadge } from './hooks/useWorkflowQueueBadge'
