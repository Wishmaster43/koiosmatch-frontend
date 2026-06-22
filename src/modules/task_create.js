// task_create module — create a follow-up task for the candidate(s) in the workflow.
import { ListChecks } from 'lucide-react'

export default {
  type:  'task_create',
  category: 'Acties',
  label: 'Taak aanmaken',
  Icon:  ListChecks,
  color: '#6E8FD6',
  bg:    '#E6EDF9',
  schema: [
    { key: 'title',           label: 'Titel',                type: 'text',   placeholder: 'Benaderen' },
    { key: 'type',            label: 'Soort',                type: 'select', options: ['task', 'call', 'email', 'note'] },
    { key: 'priority',        label: 'Prioriteit',           type: 'select', options: ['low', 'normal', 'high'] },
    { key: 'assignee',        label: 'Toewijzen aan',        type: 'select', options: ['candidate_owner', 'round_robin'] },
    { key: 'due_offset_days', label: 'Deadline over (dagen)', type: 'number', placeholder: '0' },
  ],
}
