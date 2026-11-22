// helloflex_inbound module (BE HF-WORKFLOWS-1, App\Workflow\Modules\HelloFlexInboundModule): the HelloFlex
// inbound-webhook DEPARTURE node. A valid point of origin (VERTREKMODULE-1): one run per HelloFlex webhook
// event. Config mirrors configSchema() exactly: `events` = the HelloFlex filter NAMES to listen to (required,
// multi), `fetch_entity` (re-fetch the record by GUID into helloflex_entity) and `only_linked` (skip when no
// Koios record is linked). A connector feature: offered on the HelloFlex app OR the hf module
// (CONNECTOR-VS-REPORTING-1), the same predicate the webhook route carries.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { HELLOFLEX_EVENTS } from '@/components/layout/workflow/eventCatalog'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_inbound',
  module:   'hf',
  app:      'hf',
  category: 'triggers',
  label:    'HelloFlex Inbound',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  // VERTREKMODULE-1: a valid point of origin (also listed in START_MODULE_TYPES).
  isStart:  true,
  schema: [
    // The option VALUE is the HelloFlex filter name (CreateCandidate …), the label the catalogue event label.
    { key: 'events', label: 'Events', type: 'multiselect', required: true,
      options: HELLOFLEX_EVENTS.map(e => ({ value: e.filter, label: e.label })),
      help: 'The HelloFlex events this scenario reacts to. Any other event is skipped.' },
    { key: 'fetch_entity', label: 'Fetch the entity', type: 'boolean', default: false,
      help: 'On = the HelloFlex record is read again by its GUID for the next steps (never in a dry run).' },
    { key: 'only_linked', label: 'Only linked records', type: 'boolean', default: false,
      help: 'On = an event about a record that is not linked to Koios is skipped.' },
  ],
}
