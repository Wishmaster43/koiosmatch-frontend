// tasks module — the per-entity Taken module (fetch + filter inline, plus
// create/update). Replaces the standalone task_create ("Taak aanmaken").
import { ListChecks } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'tasks',
  label:    'Tasks',
  category: 'tasks',
  Icon:     ListChecks,
  color:    'var(--module-periwinkle)',
  bg:       'color-mix(in srgb, var(--module-periwinkle) 16%, transparent)',
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'type',     label: 'Kind' },
    { value: 'assignee', label: 'Assigned to' },
    { value: 'priority', label: 'Priority' },
    { value: 'due_at',   label: 'Deadline' },
  ],
  sortOptions: [
    { value: 'due_at',     label: 'Deadline' },
    { value: 'priority',   label: 'Priority' },
    { value: 'created_at', label: 'Created' },
  ],
})
