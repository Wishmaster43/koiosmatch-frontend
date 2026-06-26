// tasks module — the per-entity Taken module (fetch + filter inline, plus
// create/update). Replaces the standalone task_create ("Taak aanmaken").
import { ListChecks } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'tasks',
  label:    'Taken',
  category: 'Taken',
  Icon:     ListChecks,
  color:    '#6E8FD6',
  bg:       '#E6EDF9',
  filterFields: [
    { value: 'status',   label: 'Status' },
    { value: 'type',     label: 'Soort' },
    { value: 'assignee', label: 'Toegewezen aan' },
    { value: 'priority', label: 'Prioriteit' },
    { value: 'due_at',   label: 'Deadline' },
  ],
  sortOptions: [
    { value: 'due_at',     label: 'Deadline' },
    { value: 'priority',   label: 'Prioriteit' },
    { value: 'created_at', label: 'Aangemaakt' },
  ],
})
