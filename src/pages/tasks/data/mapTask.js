// Two-letter initials from a name, e.g. "Danny Polak" → "DP".
const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

// First label for a polymorphic link list, used as the compact table cell.
const firstLinkLabel = (links = []) => links[0]?.label ?? ''

/**
 * mapTask — raw API task → the flat shape the table/board render. Snake_case-
 * tolerant and defensive about the exact field names (the /tasks endpoint is not
 * built yet — see docs/worklist.md C-18), so it accepts several spellings and
 * never throws on a missing field. Status/priority/type keep their KEY only; the
 * page decorates them with the tenant lookup (label/colour) like ApplicationsPage.
 */
export function mapTask(t = {}) {
  const assignee = t.assignee ?? null
  const assigneeName = assignee?.name ?? t.assignee_name ?? ''
  const owner = t.owner ?? t.created_by ?? {}
  const links = (t.links ?? []).map(l => ({
    type: l.type ?? l.linkable_type ?? '',
    id: l.id ?? l.linkable_id ?? null,
    label: l.label ?? l.name ?? '',
  }))

  return {
    id: t.id,
    title: t.title ?? t.name ?? '—',
    // Keys resolved against the lookup by the page; payload labels/colours are a fallback.
    typeKey:     t.type?.value ?? t.type_id ?? t.type ?? '',
    typeLabel:   t.type?.label ?? t.type_label ?? '',
    typeColor:   t.type?.color ?? t.type_color ?? null,
    statusKey:   t.status?.value ?? t.status_id ?? t.status ?? '',
    statusLabel: t.status?.label ?? t.status_label ?? '',
    statusColor: t.status?.color ?? t.status_color ?? null,
    statusIsDone: Boolean(t.status?.is_done ?? t.status_is_done ?? t.completed_at),
    priorityKey:   t.priority?.value ?? t.priority_id ?? t.priority ?? '',
    priorityLabel: t.priority?.label ?? t.priority_label ?? '',
    priorityColor: t.priority?.color ?? t.priority_color ?? null,
    // assignee null = "Bureau" (no specific person).
    assigneeId: assignee?.id ?? t.assignee_id ?? null,
    assignee: assigneeName ? {
      name: assigneeName, initials: initialsOf(assigneeName),
      color: assignee?.avatar_color ?? null,
    } : null,
    owner: { name: owner.name ?? t.owner_name ?? '' },
    due: t.due_date ?? t.due_at ?? '',
    completedAt: t.completed_at ?? '',
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
export function mapTaskDetail(raw = {}) {
  const base = mapTask(raw)
  return {
    ...base,
    description: raw.description ?? '',
    comments: (raw.comments ?? []).map(c => ({
      id: c.id,
      author: c.author?.name ?? c.author_name ?? '',
      authorInitials: initialsOf(c.author?.name ?? c.author_name ?? ''),
      body: c.body ?? c.text ?? '',
      time: c.created_at ?? c.time ?? '',
    })),
    activity: (raw.activity ?? raw.timeline ?? []).map(ev => ({
      id: ev.id,
      author: ev.author?.name ?? ev.author ?? '',
      description: ev.description ?? '',
      time: ev.created_at ?? ev.time ?? '',
    })),
  }
}
