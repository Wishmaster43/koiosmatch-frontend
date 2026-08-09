/**
 * assigneeOptions — the ordering + labelling rules behind AddTaskModal's
 * "Toewijzen aan" picker (Danny 08-08: "een taak moet ook aan Backoffice
 * toegewezen kunnen worden").
 *
 * This is the PERSON half only. Assigning to an internal DEPARTMENT is a second,
 * independent axis (`assignee_team_id`, TEAM-1) with its own picker and its own
 * tests in AddTaskModal.test.tsx — an earlier version of this comment said
 * `GET /teams` was a 404; it answers 200 since backend e0e2277f. What stays true
 * here: `assignee_id` is validated as a uuid of a tenant USER (a role id answers
 * 422), and `GET /users` ships each user's roles inline, so this list is a
 * colleague picker GROUPED PER ROLE whose labels carry that role. These tests pin
 * exactly that, plus the explicit "Bureau" (nobody) row.
 *
 * i18n is INJECTED into the builder, so this file asserts real strings instead
 * of the echoed keys an uninitialised i18next would produce — the grouping and
 * the search behaviour stay verifiable in every language.
 */
import { describe, it, expect } from 'vitest'
import { buildAssigneeOptions, roleNamesOf, UNASSIGNED_VALUE } from './assigneeOptions'

// Stand-ins for the injected i18n: the shared `users:roles.*` label lookup, and
// the one ICU key that composes "name · role".
const ROLE_LABELS: Record<string, string> = { backoffice: 'Backoffice', manager: 'Manager', recruiter: 'Recruiter' }
const roleLabel = (name: string) => ROLE_LABELS[name] ?? name
const withRole = (name: string, role: string) => `${name} · ${role}`

// Deliberately out of order, with both role shapes (object + bare string), a
// second backoffice colleague and one colleague with no role at all.
const USERS = [
  { id: 'u-recruiter', name: 'Ravi Yesway', roles: [{ name: 'recruiter' }] },
  { id: 'u-backoffice', name: 'Laura Yesway', roles: [{ name: 'backoffice' }] },
  { id: 'u-none', name: 'Sam Zonderrol' },
  { id: 'u-manager', name: 'Kelly Yesway', roles: [{ name: 'manager' }] },
  { id: 'u-backoffice-2', name: 'Aisha Bakker', roles: ['backoffice'] },
]

const build = (users = USERS) => buildAssigneeOptions({ users, unassignedLabel: 'Bureau (niemand toegewezen)', roleLabel, withRole })

describe('buildAssigneeOptions', () => {
  it('leads with the explicit bureau row, carrying the empty value the submit turns into assignee_id: null', () => {
    const [first] = build()
    expect(first).toEqual({ value: UNASSIGNED_VALUE, label: 'Bureau (niemand toegewezen)' })
    expect(first.value).toBe('')
  })

  it('clusters colleagues per role and parks the role-less ones last', () => {
    expect(build().map(o => o.label)).toEqual([
      'Bureau (niemand toegewezen)',
      // Backoffice before Manager before Recruiter; alphabetical within a role.
      'Aisha Bakker · Backoffice',
      'Laura Yesway · Backoffice',
      'Kelly Yesway · Manager',
      'Ravi Yesway · Recruiter',
      // No role → after every role group, and no dangling separator.
      'Sam Zonderrol',
    ])
  })

  it('lets the picker\'s own search box find "iemand van Backoffice" in one word', () => {
    // Mirrors CreatableSelect's real filter line (label.toLowerCase().includes(q)) —
    // this is WHY the role rides in the label instead of only in the sort order.
    const matches = build().filter(o => o.label.toLowerCase().includes('backoffice'))
    expect(matches.map(o => o.value)).toEqual(['u-backoffice-2', 'u-backoffice'])
  })

  it('drops a row with no usable id — its value would collide with the bureau row and silently select "niemand"', () => {
    const options = buildAssigneeOptions({
      users: [{ name: 'Geen id' }, { id: '', name: 'Lege id' }, { id: 'u-1', name: 'Echt' }],
      unassignedLabel: 'Bureau', roleLabel, withRole,
    })
    expect(options.map(o => o.value)).toEqual(['', 'u-1'])
  })

  it('keeps a colleague pickable even when the whole role list is empty', () => {
    const options = buildAssigneeOptions({ users: [{ id: 'u-1', name: 'Solo', roles: [] }], unassignedLabel: 'Bureau', roleLabel, withRole })
    expect(options[1]).toEqual({ value: 'u-1', label: 'Solo' })
  })
})

describe('roleNamesOf', () => {
  it('reads both the object shape /users actually ships and a bare string role', () => {
    expect(roleNamesOf({ id: 'u', roles: [{ name: 'backoffice' }, 'manager'] })).toEqual(['backoffice', 'manager'])
  })

  it('is empty (never throws) for a user without roles, and skips nameless entries', () => {
    expect(roleNamesOf({ id: 'u' })).toEqual([])
    expect(roleNamesOf({ id: 'u', roles: [{}, ''] })).toEqual([])
  })
})
