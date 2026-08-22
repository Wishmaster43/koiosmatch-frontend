// task_create module — create a follow-up task for a workflow subject (native ATS
// action). The flagship `tasks` entity module (Aanmaken action) absorbs most task
// automation going forward, but this standalone type stays registered because
// SEEDED templates still use it verbatim (NativeWorkflowTemplates.php,
// RetentionWorkflowTemplates.php, NotificationTemplates.php, AiAgentTemplates.php —
// e.g. "Heractivering"'s "Taak: benaderen" step). Field keys mirror
// App\Workflow\Modules\TaskCreateModule::configSchema() exactly.
import { ListPlus } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:  'task_create',
  category: 'Taken',
  label: 'Taak aanmaken',
  Icon:  ListPlus,
  color: 'var(--module-periwinkle)',
  // Active-strength tint (16%, matches the flagship `tasks` module's own bg).
  bg:    tintBg('var(--module-periwinkle)', true),
  schema: [
    { key: 'title', label: 'Titel', type: 'text' },
    // Tenant lookups (§10): the stored value is the lookup's immutable slug,
    // matching TaskType::where('value', …) / TaskPriority::where('value', …).
    { key: 'type', label: 'Soort', type: 'lookup_select', endpoint: '/task-types' },
    { key: 'priority', label: 'Prioriteit', type: 'lookup_select', endpoint: '/task-priorities' },
    // BE resolves the owner strategy from this exact string set (or a raw user
    // uuid, not offered here — TaskCreateModule::resolveAssignee/ownerAssignee).
    { key: 'assignee', label: 'Toewijzen aan', type: 'select',
      options: ['candidate_owner', 'customer_owner', 'vacancy_owner'],
      help: 'Leeg = geen toewijzing (bureau).' },
    { key: 'due_offset_days', label: 'Deadline over (dagen)', type: 'number', placeholder: '0' },
  ],
}
