/**
 * canDo / hasPermissionFamily — WORKFLOW-PERMS-1: open while a backend has not seeded the
 * family, exact once it has, super admins always allowed.
 */
import { describe, it, expect } from 'vitest'
import { canDo, hasPermissionFamily } from './access'

const auth = (permissions: unknown[], is_super_admin = false) => ({ user: { permissions, is_super_admin } })

describe('canDo (WORKFLOW-PERMS-1)', () => {
  it('is open while the payload carries no permission of the family at all', () => {
    expect(canDo(auth(['candidates.view', 'page.workflows']), 'workflows', 'run')).toBe(true)
    expect(hasPermissionFamily(auth(['page.workflows']), 'workflows')).toBe(false)
    expect(canDo(null, 'workflows', 'run')).toBe(true)
  })

  it('decides on the exact verb once the family is present, in both string and object shape', () => {
    expect(canDo(auth(['workflows.view', 'workflows.run']), 'workflows', 'run')).toBe(true)
    expect(canDo(auth(['workflows.view']), 'workflows', 'run')).toBe(false)
    expect(canDo(auth([{ name: 'aiagents.view' }, { name: 'aiagents.run' }]), 'aiagents', 'run')).toBe(true)
    expect(canDo(auth([{ name: 'aiagents.view' }]), 'aiagents', 'delete')).toBe(false)
  })

  it('a super admin always may', () => {
    expect(canDo(auth(['workflows.view'], true), 'workflows', 'delete')).toBe(true)
  })
})
