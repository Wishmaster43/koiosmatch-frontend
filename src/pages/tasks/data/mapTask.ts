import { initialsOf } from '@/lib/initials'
import type { ApiTask, Task, TaskDetail, TaskLink } from '@/types/task'

// First label for a polymorphic link list, used as the compact table cell.
const firstLinkLabel = (links: TaskLink[] = []): string => links[0]?.label ?? ''

// A lookup field arrives as { value,label,color,is_done } OR a bare scalar key.
type LookupRaw = { value?: string | number; label?: string; color?: string; is_done?: unknown; name?: string }
const asObj = (x: unknown): LookupRaw => (x && typeof x === 'object' ? (x as LookupRaw) : {})
const asKey = (x: unknown): string | number | undefined =>
  x != null && typeof x !== 'object' ? (x as string | number) : undefined

/**
 * mapTask — raw API task → the flat shape the table/board render. Snake_case-
 * tolerant and defensive about the exact field names (the /tasks endpoint is not
 * built yet — see docs/worklist.md C-18), so it accepts several spellings and
 * never throws on a missing field. Status/priority/type keep their KEY only; the
 * page decorates them with the tenant lookup (label/colour) like ApplicationsPage.
 */
export function mapTask(t: ApiTask = {}): Task {
  const assignee = t.assignee ?? null
  const assigneeName = assignee?.name ?? t.assignee_name ?? ''
  const owner: { name?: string } = t.owner ?? t.created_by ?? {}
  const links: TaskLink[] = (t.links ?? []).map(l => ({
    type: l.type ?? l.linkable_type ?? '',
    id: l.id ?? l.linkable_id ?? null,
    label: l.label ?? l.name ?? '',
  }))

  return {
    id: t.id,
    title: t.title ?? t.name ?? '—',
    // Keys resolved against the lookup by the page; payload labels/colours are a fallback.
    typeKey:     asObj(t.type).value ?? t.type_id ?? asKey(t.type) ?? '',
    typeLabel:   asObj(t.type).label ?? t.type_label ?? '',
    typeColor:   asObj(t.type).color ?? t.type_color ?? null,
    statusKey:   asObj(t.status).value ?? t.status_id ?? asKey(t.status) ?? '',
    statusLabel: asObj(t.status).label ?? t.status_label ?? '',
    statusColor: asObj(t.status).color ?? t.status_color ?? null,
    statusIsDone: Boolean(asObj(t.status).is_done ?? t.status_is_done ?? t.completed_at),
    priorityKey:   asObj(t.priority).value ?? t.priority_id ?? asKey(t.priority) ?? '',
    priorityLabel: asObj(t.priority).label ?? t.priority_label ?? '',
    priorityColor: asObj(t.priority).color ?? t.priority_color ?? null,
    // assignee null = "Bureau" (no specific person).
    assigneeId: assignee?.id ?? t.assignee_id ?? null,
    assignee: assigneeName ? {
      name: assigneeName, initials: initialsOf(assigneeName),
      color: assignee?.avatar_color ?? null,
    } : null,
    owner: { name: owner.name ?? t.owner_name ?? '' },
    due: t.due_date ?? t.due_at ?? '',
    completedAt: t.completed_at ?? '',
    tags: Array.isArray(t.tags) ? t.tags.filter(Boolean) : [],
    links,
    linkLabel: firstLinkLabel(links),
    commentCount: t.comment_count ?? (t.comments?.length ?? 0),
    createdAt: t.created_at ?? '',
  }
}

/**
 * mapTaskDetail — raw API detail (GET /tasks/{id}) → the shape the drawer tabs
 * render. Builds on mapTask and normalises description, links, comments and the
 * activity log. Defensive: every nested list defaults to [] so a tab never crashes.
 */
export function mapTaskDetail(raw: ApiTask = {}): TaskDetail {
  const base = mapTask(raw)
  return {
    ...base,
    description: raw.description ?? '',
    comments: (raw.comments ?? raw.notes ?? []).map(c => ({
      id: c.id,
      author: c.author?.name ?? c.author_name ?? '',
      authorInitials: initialsOf(c.author?.name ?? c.author_name ?? ''),
      body: c.body ?? c.text ?? '',
      time: c.created_at ?? c.time ?? '',
    })),
    activity: (raw.activity ?? raw.timeline ?? []).map(ev => ({
      id: ev.id,
      author: asObj(ev.author).name ?? (typeof ev.author === 'string' ? ev.author : '') ?? '',
      description: ev.description ?? '',
      time: ev.created_at ?? ev.time ?? '',
    })),
    // Tenant custom-field values (§3B "Eigen velden").
    customFields: raw.custom_fields ?? {},
  }
}
