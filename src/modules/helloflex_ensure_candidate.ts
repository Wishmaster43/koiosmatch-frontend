// helloflex_ensure_candidate module (BE HF-ENTITY-SYNC-1a, App\Workflow\Modules\HelloFlexEnsureCandidateModule): create the HelloFlex candidate for each pipeline candidate, or adopt the one HelloFlex already holds.
// A connector WRITE step: offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1),
// the same predicate the BE WorkflowWriter checks; blocked in a dry run; output adds helloflex_sync
// {kind, done, skipped, errors} and candidate_guid. Field keys mirror configSchema() exactly.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_ensure_candidate',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Ensure HelloFlex candidate',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
    // The pipeline list the step reads; empty = the record that started the run.
    { key: 'source', label: 'Source list', type: 'text',
      help: 'The pipeline list to read, for example matches. Leave empty to use the record that started the workflow.' },
    { key: 'adopt_by_email', label: 'Adopt by e-mail', type: 'boolean', default: true,
      help: 'Link an existing HelloFlex candidate with the same e-mail address instead of creating a second one.' },
  ],
}
