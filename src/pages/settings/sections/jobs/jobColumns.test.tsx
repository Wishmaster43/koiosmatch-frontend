import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { jobColumns } from './jobColumns'

describe('jobColumns', () => {
  it('returns the three shared columns: queue, tenant, job', () => {
    const t = ((key: string) => key) as unknown as TFunction

    const columns = jobColumns(t)

    expect(columns).toHaveLength(3)
    expect(columns[0].key).toBe('queue')
    expect(columns[1].key).toBe('tenant_id')
    expect(columns[2].key).toBe('job')
  })

  it('renders tenant as "central" label when tenant_id is "central"', () => {
    const t = ((key: string) => {
      if (key === 'jobs.centralTenant') return 'Central Tenant'
      return key
    }) as unknown as TFunction

    const columns = jobColumns(t)
    const tenantRender = columns[1].render!

    const result = tenantRender({ tenant_id: 'central' })
    expect(result).toBe('Central Tenant')

    const result2 = tenantRender({ tenant_id: 'yesway' })
    expect(result2).toBe('yesway')
  })
})
