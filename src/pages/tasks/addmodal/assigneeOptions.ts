/**
 * addmodal/assigneeOptions — builds the "Toewijzen aan" option list for
 * AddTaskModal's AssignmentCard. Pure and framework-free, so the ordering and
 * labelling rules below are unit-testable without a QueryClient (the hook that
 * feeds it lives next door in `useAssigneeOptions`).
 *
 * SCOPE — this file builds the PERSON half only. Assigning a task to an internal
 * DEPARTMENT is a second, independent axis (`assignee_team_id`, TEAM-1, backend
 * e0e2277f): it has its own picker in AssignmentCard fed by `@/lib/useTeams`, and
 * picking a person here deliberately leaves that department standing (measured
 * 09-08 — a PATCH with only `assignee_id` returns the same `assignee_team`). An
 * earlier version of this comment claimed `GET /teams` was a 404; it now answers
 * 200, and the honest gate it justified is gone.
 *
 * A task's `assignee_id` is one uuid of a USER of this tenant (posting a role id
 * came back `422 {"assignee_id":["…must be a valid UUID.","…does not belong to
 * this tenant."]}`), so this list contains only real users. It GROUPS THEM BY
 * ROLE: `GET /users` ships every user's roles inline (measured: Laura Yesway →
 * `roles:[{id:7,name:"backoffice",…}]`, Kelly → manager, Ravi → recruiter), rows
 * are ordered by their role label (same-role colleagues land together, role-less
 * ones last) and each label carries its role, which is what the shared
 * CreatableSelect's search box filters on. Typing "backoffice" therefore narrows
 * the list to the backoffice colleagues in one search.
 *
 * The empty value is a REAL first option ("Bureau — niemand toegewezen"), never
 * a placeholder: `assignee_id: null` is a measured, accepted create (201, the
 * task comes back with `assignee: null`), so an unassigned task is a legitimate
 * choice a recruiter must be able to make on purpose.
 */
import { userName } from './formHelpers'
import type { UserLike } from './formHelpers'

export interface AssigneeOption { value: string; label: string }

// The unassigned ("bureau") choice. Empty string, because that is what the form
// state holds and what the submit path turns into `assignee_id: null`.
export const UNASSIGNED_VALUE = ''

// Tolerant role names for one user row: /users ships role OBJECTS today, but a
// bare-string role is the shape the rest of the app also accepts (usersParts'
// RoleRef), so neither breaks the picker.
export const roleNamesOf = (u: UserLike): string[] =>
  (u.roles ?? []).map(r => (typeof r === 'string' ? r : r?.name ?? '')).filter(Boolean)

/**
 * The assignee options: the explicit bureau row first, then every colleague
 * clustered per role. `roleLabel`/`withRole` are injected so this stays pure —
 * the caller owns i18n (the role labels are the SHARED `users:roles.*` ones, and
 * the name+role line is one ICU-interpolated key, never string concatenation §5).
 */
export function buildAssigneeOptions({ users, unassignedLabel, roleLabel, withRole }: {
  users: UserLike[]
  unassignedLabel: string
  roleLabel: (roleName: string) => string
  withRole: (name: string, role: string) => string
}): AssigneeOption[] {
  // Decorate once so the sort key and the rendered label agree on the same
  // translated role text. A row without a usable id is dropped: its value would
  // collide with the bureau option's empty value and silently select "niemand".
  const rows = users
    .filter(u => u.id != null && String(u.id) !== '')
    .map(u => {
      const name = userName(u)
      const role = roleNamesOf(u).map(roleLabel).filter(Boolean).join(', ')
      // '0'+role clusters the roled colleagues alphabetically per role; the bare
      // '1' parks every role-less colleague after all of those groups.
      return { value: String(u.id), name, role, groupKey: role ? `0${role}` : '1' }
    })
    // Two explicit sort levels (group, then name) rather than one concatenated
    // key — a composite string would hinge on a separator collation may ignore.
    .sort((a, b) => (a.groupKey === b.groupKey ? a.name.localeCompare(b.name) : a.groupKey.localeCompare(b.groupKey)))

  return [
    { value: UNASSIGNED_VALUE, label: unassignedLabel },
    ...rows.map(r => ({ value: r.value, label: r.role ? withRole(r.name, r.role) : r.name })),
  ]
}
