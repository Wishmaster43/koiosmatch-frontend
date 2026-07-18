/**
 * Task shapes — the UI models (`Task` for the table/board, `TaskDetail` for the
 * drawer) and the raw API record (`ApiTask`), read defensively by mapTask /
 * mapTaskDetail. Status/priority/type arrive as a { value,label,color } object or
 * a bare scalar key; both are tolerated.
 */
import type { Id } from './common'

/** A polymorphic link target on a task (candidate, vacancy, customer, …). */
export interface TaskLink {
  type: string
  id: Id | null
  label: string
}

/** The flat task model rendered by the table/board. */
export interface Task {
  id: Id | undefined
  title: string
  typeKey: string | number
  typeLabel: string
  typeColor: string | null
  statusKey: string | number
  statusLabel: string
  statusColor: string | null
  statusIsDone: boolean
  priorityKey: string | number
  priorityLabel: string
  priorityColor: string | null
  assigneeId: Id | null
  assignee: { name: string; initials: string; color: string | null } | null
  owner: { name: string }
  due: string
  // TASK-DUE-TIME-1 (BE 3f1274d): optional 24h "HH:mm" time-of-day on the due date.
  dueTime: string
  completedAt: string
  tags: string[]
  links: TaskLink[]
  linkLabel: string
  commentCount: number
  createdAt: string
  // Enkelstuks-sweep: soft-delete state. The list resource carries no `deleted_at`/
  // `archived` field yet (measured — TaskListResource/TaskDetailResource), so this is
  // derived client-side from which fetch (active vs ?archived=1) produced the row.
  archived?: boolean
  archivedAt?: string | null
}

/** The enriched task model rendered by the drawer tabs. */
export interface TaskDetail extends Task {
  description: string
  comments: Array<{ id: Id | undefined; author: string; authorInitials: string; body: string; time: string }>
  activity: Array<{ id: Id | undefined; author: string; description: string; time: string }>
  // Tenant custom-field values (§3B "Eigen velden" — the drawer's gated Extra tab).
  customFields: Record<string, unknown>
}

/** Raw API task record (read defensively). */
export interface ApiTask {
  id?: Id
  title?: string
  name?: string
  type?: unknown
  type_id?: string | number
  type_label?: string
  type_color?: string
  status?: unknown
  status_id?: string | number
  status_label?: string
  status_color?: string
  status_is_done?: unknown
  priority?: unknown
  priority_id?: string | number
  priority_label?: string
  priority_color?: string
  assignee?: { id?: Id; name?: string; avatar_color?: string | null } | null
  assignee_name?: string
  assignee_id?: Id
  owner?: { name?: string }
  created_by?: { name?: string }
  owner_name?: string
  due_date?: string
  due_at?: string
  // TASK-DUE-TIME-1: "HH:mm" (24h), already trimmed to 5 chars by the API resource.
  due_time?: string
  completed_at?: string
  created_at?: string
  // Present only when the row came from a soft-deleted-only fetch (never returned
  // by the backend today — see the Task interface comment above).
  archived?: boolean
  deleted_at?: string | null
  tags?: string[]
  links?: Array<{ type?: string; linkable_type?: string; id?: Id; linkable_id?: Id; label?: string; name?: string }>
  comment_count?: number
  comments?: Array<{ id?: Id; author?: { name?: string }; author_name?: string; body?: string; text?: string; created_at?: string; time?: string }>
  // NOTES-4b: the canonical field name once BE renames the resource (same rows).
  notes?: Array<{ id?: Id; author?: { name?: string }; author_name?: string; body?: string; text?: string; created_at?: string; time?: string }>
  description?: string
  activity?: Array<{ id?: Id; author?: { name?: string } | string; description?: string; created_at?: string; time?: string }>
  timeline?: Array<{ id?: Id; author?: { name?: string } | string; description?: string; created_at?: string; time?: string }>
  // Tenant custom-field values (§3B "Eigen velden").
  custom_fields?: Record<string, unknown>
  [k: string]: unknown
}
