// workflow_call module (WF-RELATIONS-1) — the Make-style "Workflow aanroepen"
// node: dispatch a CHILD workflow (async, via the queue) and pass the current
// bundle along. Loop-protected on the backend (cycle + max-depth refusal);
// dry-run propagates to the child. Field keys mirror
// App\Workflow\Modules\WorkflowCallModule::configSchema() exactly — `type:
// 'workflow'` is a dedicated schema-field type rendering a searchable picker
// fed by GET /workflows (see fieldControls/'s WorkflowSelectField). K-254
// (WF-RELATIONS-FE-2) adds mode/fail_on_child_error/pass_bundle/payload with the
// backend's keys, labels, options and defaults; the ONE FE-only addition is the
// showIf that hides fail_on_child_error outside sync mode (see its comment).
import { Workflow as WorkflowIcon } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:  'workflow_call',
  category: 'Flow beheer',
  label: 'Workflow aanroepen',
  Icon:  WorkflowIcon,
  color: 'var(--module-purple)',
  bg:    tintBg('var(--module-purple)'),
  schema: [
    { key: 'workflow_id', label: 'Workflow', type: 'workflow',
      hint: 'De workflow die als kind wordt gestart (async, via de wachtrij). Zelf-aanroep en kringlopen worden geweigerd; maximaal 5 niveaus diep.' },
    // mode: queue (default, fire-and-forget) vs sync (inline, outcome merges back).
    { key: 'mode', label: 'Uitvoering', type: 'select', options: ['queue', 'sync'],
      hint: 'queue (standaard) = wachtrij, deze stap wacht niet. sync = direct uitvoeren; de uitkomst van het kind komt terug in deze stap.' },
    // Only meaningful in sync mode — the backend's own description says so
    // ("Alleen bij direct uitvoeren"), so the FE gates it on mode === 'sync'
    // even though BE configSchema carries no show_if field (no fake affordance, §3).
    { key: 'fail_on_child_error', label: 'Stop bij mislukt kind (sync)', type: 'boolean', default: true,
      hint: 'Alleen bij direct uitvoeren: een mislukte kind-workflow laat deze stap mislukken. Uit = doorgaan; de uitkomst staat in child_run_status.',
      showIf: { key: 'mode', value: 'sync' } },
    { key: 'pass_bundle', label: 'Huidige records meesturen', type: 'boolean',
      hint: 'Standaard aan: de kandidaten/records van deze stap reizen mee als context van het kind.' },
    { key: 'payload', label: 'Extra gegevens', type: 'keyvalue',
      hint: 'Extra sleutel/waarde-paren voor het kind ({{trigger.*}} wordt hier al opgelost).' },
  ],
}
