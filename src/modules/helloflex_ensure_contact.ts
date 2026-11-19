// helloflex_ensure_contact module (BE HF-ENTITY-SYNC-1a, App\Workflow\Modules\HelloFlexEnsureContactModule): create the HelloFlex contact person for each pipeline record, or adopt the existing one.
// A connector WRITE step: offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1),
// the same predicate the BE WorkflowWriter checks; blocked in a dry run; output adds helloflex_sync
// {kind, done, skipped, errors} and contact_guid. Field keys mirror configSchema() exactly.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_ensure_contact',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Ensure HelloFlex contact',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
    // The pipeline list the step reads; empty = the record that started the run.
    { key: 'source', label: 'Source list', type: 'text',
      help: 'The pipeline list to read, for example matches. Leave empty to use the record that started the workflow.' },
  ],
}
