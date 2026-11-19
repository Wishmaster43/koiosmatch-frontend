// helloflex_candidate_deactivate module (BE HF-ENTITY-SYNC-1a, App\Workflow\Modules\HelloFlexCandidateDeactivateModule): send one JSON Patch to the configured inactive state, never a DELETE (no config).
// A connector WRITE step: offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1),
// the same predicate the BE WorkflowWriter checks; blocked in a dry run; output adds helloflex_sync
// {kind, done, skipped, errors}. Field keys mirror configSchema() exactly.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_candidate_deactivate',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Deactivate HelloFlex candidate',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
  ],
}
