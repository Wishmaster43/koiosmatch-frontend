// leads_recount module (WF-LEADS-WORKFLOW-1, Danny 22-08: "moet wel een workflow
// zijn") — queue the coded vacancy-leads recount from the tenant's own scheduled
// workflow: the workflow decides THAT it runs and how often, the engine sweep
// does the counting (§0.11 split). Field key/options mirror
// App\Workflow\Modules\LeadsRecountModule::configSchema() exactly.
import { RefreshCw } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:     'leads_recount',
  category: 'Vacatures',
  label:    'Leads-telling vacatures',
  Icon:     RefreshCw,
  // Same violet family as the Vacatures entity module — one category, one hue.
  color:    'var(--color-violet)',
  bg:       tintBg('var(--color-violet)'),
  schema: [
    { key: 'scope', label: 'Welke vacatures', type: 'select', default: 'stale',
      options: [
        { value: 'stale', label: 'Alleen gewijzigde (aanbevolen)' },
        { value: 'all', label: 'Alle vacatures' },
      ],
      hint: 'De voorwaarden volgen altijd de matchcriteria van de vacature zelf: wie ze wil wijzigen, wijzigt de matchcriteria of de wegingstemplates. Deze stap kiest alleen de set.' },
  ],
}
