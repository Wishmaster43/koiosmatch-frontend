/**
 * roleIcons — verify the three newly-added role icons render without error (X-46).
 */
import { describe, it, expect } from 'vitest'
import { resolveRoleIcon } from './roleIcons'
import { Shield, UserCheck, Building2, TrendingUp } from 'lucide-react'

describe('roleIcons — X-46 newly-added icons', () => {
  it('resolves user-check to the correct component', () => {
    const icon = resolveRoleIcon('user-check')
    expect(icon).toBe(UserCheck)
  })

  it('resolves building-2 to the correct component', () => {
    const icon = resolveRoleIcon('building-2')
    expect(icon).toBe(Building2)
  })

  it('resolves trending-up to the correct component', () => {
    const icon = resolveRoleIcon('trending-up')
    expect(icon).toBe(TrendingUp)
  })

  it('falls back to Shield for unknown names', () => {
    const icon = resolveRoleIcon('nonexistent-icon')
    expect(icon).toBe(Shield)
  })
})
