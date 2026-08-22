// experience_add module (BIRTHDAY-FLOW-2 contract-fix) — the standalone engine
// module behind the seeded "Match → werkervaring" template
// (NativeWorkflowTemplates.php: "Werkervaring toevoegen (bovenaan)"). Mirrors the
// imperative core writer (MatchMaker::addWorkExperience) so the CV entry has ONE
// shape; distinct from the flagship `candidates` entity module's own inline
// "Werkervaring toevoegen" action (different config keys). Field keys mirror
// App\Workflow\Modules\ExperienceAddModule::configSchema() exactly — both fields
// are closed single-option vocabularies today (source: match only, position: top
// only), kept as `select` so a future backend option surfaces without a schema
// rewrite.
import { Briefcase } from 'lucide-react'

export default {
  type:  'experience_add',
  category: 'Kandidaten',
  label: 'Werkervaring toevoegen',
  Icon:  Briefcase,
  color: 'var(--color-secondary)',
  bg:    'var(--color-secondary-bg)',
  schema: [
    { key: 'source', label: 'Bron', type: 'select', options: ['match'], default: 'match' },
    { key: 'position', label: 'Positie in CV', type: 'select', options: ['top'], default: 'top' },
  ],
}
