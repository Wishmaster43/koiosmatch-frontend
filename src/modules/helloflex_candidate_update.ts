// helloflex_candidate_update module (BE HF-ENTITY-SYNC-1a, App\Workflow\Modules\HelloFlexCandidateUpdateModule): send the chosen outbound fields of a LINKED candidate to HelloFlex (an unlinked one is skipped not_linked).
// A connector WRITE step: offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1),
// the same predicate the BE WorkflowWriter checks; blocked in a dry run; output adds helloflex_sync
// {kind, done, skipped, errors}. Field keys mirror configSchema() exactly.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'
import { HELLOFLEX_OUTBOUND_CANDIDATE_COLUMNS } from './_helloflexFields'

export default {
  type:     'helloflex_candidate_update',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Update HelloFlex candidate',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
    // The outbound candidate columns of the BE CandidateFieldMap (direction out/both). No FE default on
    // purpose: the BE defaults to every column and both sides read an empty list as "all".
    { key: 'fields', label: 'Fields to send', type: 'multiselect', options: HELLOFLEX_OUTBOUND_CANDIDATE_COLUMNS,
      help: 'Empty = every outbound field.' },
  ],
}
