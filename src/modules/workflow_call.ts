// workflow_call module (WF-RELATIONS-1) — the Make-style "Workflow aanroepen"
// node: dispatch a CHILD workflow (async, via the queue) and pass the current
// bundle along. Loop-protected on the backend (cycle + max-depth refusal);
// dry-run propagates to the child. Field key mirrors
// App\Workflow\Modules\WorkflowCallModule::configSchema() exactly — `type:
// 'workflow'` is a dedicated schema-field type rendering a searchable picker
// fed by GET /workflows (see fieldControls/'s WorkflowSelectField).
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
  ],
}
