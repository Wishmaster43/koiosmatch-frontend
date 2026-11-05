// leads_recount module (WF-LEADS-WORKFLOW-1, Danny 22-08: "this really has to
// be a workflow") — queue the coded vacancy-leads recount from the tenant's own scheduled
// workflow: the workflow decides THAT it runs and how often, the engine sweep
// does the counting (§0.11 split). Field key/options mirror
// App\Workflow\Modules\LeadsRecountModule::configSchema() exactly.
import { RefreshCw } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:     'leads_recount',
  category: 'vacancies',
  label:    'Vacancy leads count',
  Icon:     RefreshCw,
  // Same violet family as the Vacatures entity module — one category, one hue.
  color:    'var(--color-violet)',
  bg:       tintBg('var(--color-violet)'),
  schema: [
    { key: 'scope', label: 'Which vacancies', type: 'select', default: 'stale',
      options: [
        { value: 'stale', label: 'Only changed (recommended)' },
        { value: 'all', label: 'All vacancies' },
      ],
      hint: 'The conditions always follow the vacancy\'s own match criteria: to change them, change the match criteria or the weighting templates. This step only picks the set.' },
  ],
}
