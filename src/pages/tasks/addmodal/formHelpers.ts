/**
 * addmodal/formHelpers — the pure, testable bits AddTaskModal needs but that are
 * not wiring: the tolerant row/user display names its option lists render, and
 * the 422 field-key map. Split out of the container (§3: it kept growing past
 * its size target while doing one job — wiring the form).
 */
import type { Id } from '@/types/common'

// One row of a linked-entity list endpoint (/candidates, /customers, /contacts).
export interface EntityRow { id?: Id; name?: string; first_name?: string; last_name?: string; title?: string; email?: string }
// One role as it can sit on a /users row: the API ships objects (measured 09-08:
// `roles:[{id:7,name:"backoffice",color:"#D97706",icon:"clipboard-list"}]`), a
// bare string is the looser shape the rest of the app also tolerates.
export type UserRoleRef = string | { name?: string }
// One row of /users, tolerant of the various name shapes it returns. `roles` is
// what lets the assignee picker cluster colleagues per role (assigneeOptions.ts).
export interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string; roles?: UserRoleRef[] }

// Tolerant display name for the linked-entity option lists.
export const nameOf = (r: EntityRow): string => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.title || r.email || `#${r.id}`
export const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// 422 field-error keys are snake_case; map them back to the form's field names.
// TASKTYPE-ID-1: both create and edit POST/PATCH the real uuid FKs
// (type_id/status_id/priority_id — the only keys Store/UpdateTaskRequest
// validate), so both write paths return the SAME error-field names.
export const API_TO_FORM: Record<string, string> = {
  title: 'title', assignee_id: 'assigneeId',
  due_date: 'due', due_time: 'dueTime', description: 'description',
  type_id: 'type', status_id: 'status', priority_id: 'priority',
}
