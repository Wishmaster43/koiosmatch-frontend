// helloflex_activity_create module (BE HF-ENTITY-SYNC-1a, App\Workflow\Modules\HelloFlexActivityCreateModule): write the placement activity of the match to HelloFlex (no config).
// A connector WRITE step: offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1),
// the same predicate the BE WorkflowWriter checks; blocked in a dry run; output adds helloflex_sync
// {kind, done, skipped, errors} and activity_guid. Field keys mirror configSchema() exactly.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_activity_create',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Create HelloFlex activity',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
  ],
}
