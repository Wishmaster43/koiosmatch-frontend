// candidate_archive module (P11-FASE4 AVG-flow) — soft-archive one candidate from a
// workflow run (the retention-overdue sweep). Reversible: delegates to the same
// CandidateBulkService::archive() the drill-down "Archiveren" button uses, never
// a hard delete/anonymisation. Field key mirrors
// App\Workflow\Modules\CandidateArchiveModule::configSchema() exactly.
import { Archive } from 'lucide-react'

export default {
  type:  'candidate_archive',
  category: 'Kandidaten',
  label: 'Kandidaat archiveren',
  // §4: the same token/icon pair the Archived quick-view toggle already uses
  // (CandidatesToolbar) — one "archived" identity across the app.
  Icon:  Archive,
  color: 'var(--color-archive)',
  bg:    'var(--color-warning-bg)',
  schema: [
    { key: 'reason', label: 'Archiefreden', type: 'text',
      hint: 'Tekst die op de kandidaat en in de audit-trail komt te staan.' },
  ],
}
