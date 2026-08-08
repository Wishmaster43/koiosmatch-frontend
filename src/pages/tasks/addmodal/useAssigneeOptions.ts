/**
 * addmodal/useAssigneeOptions — the data half of AddTaskModal's "Toewijzen aan"
 * field: it loads the tenant's users, turns them into the role-grouped option
 * list (`buildAssigneeOptions`, the pure half next door) and reports the four UI
 * states the card has to render (§3: loading · error+retry · empty · success).
 * Kept out of the container so the modal stays a thin wiring component (§3:
 * logic lives in hooks).
 *
 * Loading is `isFetching && isPlaceholderData`, not `isLoading`: `useUsers`
 * hands out a stable EMPTY_USERS placeholder, so the query reports data from the
 * first render and the plain loading flag never turns on.
 *
 * `roleLabel` is IMPORTED from the users page rather than re-implemented here.
 * §11 (one source) outranks §2's folder guidance in this trade: the seeded role
 * labels live at `users:roles.<name>` and a second local copy of that lookup is
 * exactly the drift §11 forbids. The honest follow-up is to move that one-liner
 * to `src/lib/` — not done here because usersParts.tsx belongs to another lane
 * this round.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useUsers } from '@/lib/queries'
import { roleLabel } from '@/pages/users/usersParts'
import { buildAssigneeOptions } from './assigneeOptions'
import type { AssigneeOption } from './assigneeOptions'
import type { UserLike } from './formHelpers'

export interface AssigneeOptionsState {
  // The raw tenant users — the modal still needs them for its `meIsAssignable` guard.
  users: UserLike[]
  options: AssigneeOption[]
  loading: boolean
  error: boolean
  // Absent when the query hook exposes no refetch (never render a dead retry button).
  retry?: () => void
  // False when the bureau row is the ONLY option — an honest empty state.
  hasColleagues: boolean
}

// Stable empty list — a fresh `[]` fallback per render would change the memo's
// deps every render (the same reason lib/queries keeps its own EMPTY_USERS).
const NO_USERS: UserLike[] = []

// Shape of the shared users query, narrowed to the fields this hook reads.
interface UsersQuery {
  data?: UserLike[]
  isError?: boolean
  isFetching?: boolean
  isPlaceholderData?: boolean
  refetch?: () => void
}

export function useAssigneeOptions(): AssigneeOptionsState {
  const { t } = useTranslation('tasks')
  // Role labels come from the SHARED users vocabulary, so the picker names a role
  // exactly like the users page does; a tenant-created role has no key and falls
  // back to its own name (runtime data, not a hardcoded second label).
  const { t: tUsers } = useTranslation('users')
  const query = useUsers() as UsersQuery
  const users = useMemo(() => query.data ?? NO_USERS, [query.data])

  // Rebuild only when the list or the active language actually changes.
  const options = useMemo(() => buildAssigneeOptions({
    users,
    unassignedLabel: t('modal.assigneeUnassigned'),
    roleLabel: (name: string) => roleLabel(tUsers, name),
    withRole: (name: string, role: string) => t('modal.assigneeWithRole', { name, role }),
  }), [users, t, tUsers])

  return {
    users,
    options,
    loading: !!query.isFetching && !!query.isPlaceholderData,
    error: !!query.isError,
    retry: query.refetch,
    hasColleagues: options.length > 1,
  }
}
