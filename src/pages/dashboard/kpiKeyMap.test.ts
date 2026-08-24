/**
 * kpiKeyMap — DASH-V3-UITROL-1 coverage pin: the 18 v3 server keys (K-179,
 * config/dashboard_kpis.php) must all round-trip through LOCAL_TO_SERVER /
 * SERVER_TO_LOCAL, and apiRoleForType must know the two new server roles
 * ('planning'/'readonly') instead of silently falling back to 'default'.
 */
import { describe, it, expect } from 'vitest'
import { LOCAL_TO_SERVER, SERVER_TO_LOCAL, serverKeysToLocal, localIdsToServer, apiRoleForType } from './kpiKeyMap'

const V3_SERVER_KEYS = [
  'matches_active', 'applications_active', 'vacancies_stale', 'redeploy_due_14d',
  'time_to_submit_avg', 'opps_new', 'opps_stalled', 'opps_win_rate',
  'customers_active', 'customers_prospect', 'customers_at_risk',
  'placements_incomplete', 'documents_expiring_30d', 'open_shifts_48h',
  'shifts_unconfirmed', 'shifts_noshow_today', 'shifts_cancelled_today',
  'candidates_available',
]

describe('kpiKeyMap · DASH-V3-UITROL-1 coverage', () => {
  it('every v3 server key has a local id in LOCAL_TO_SERVER', () => {
    const serverValues = new Set(Object.values(LOCAL_TO_SERVER))
    const missing = V3_SERVER_KEYS.filter(k => !serverValues.has(k))
    expect(missing, `missing from LOCAL_TO_SERVER: ${missing.join(', ')}`).toEqual([])
  })

  it('every v3 server key round-trips through SERVER_TO_LOCAL back to a known local id', () => {
    const missing = V3_SERVER_KEYS.filter(k => !SERVER_TO_LOCAL[k])
    expect(missing, `missing from SERVER_TO_LOCAL: ${missing.join(', ')}`).toEqual([])
  })

  it('serverKeysToLocal/localIdsToServer never silently drop a v3 key', () => {
    expect(serverKeysToLocal(V3_SERVER_KEYS)).toHaveLength(V3_SERVER_KEYS.length)
    const localIds = serverKeysToLocal(V3_SERVER_KEYS)
    expect(localIdsToServer(localIds)).toHaveLength(V3_SERVER_KEYS.length)
  })

  it('apiRoleForType knows planning and readonly as their own server role (no default fallback)', () => {
    expect(apiRoleForType('planning')).toBe('planning')
    expect(apiRoleForType('readonly')).toBe('readonly')
  })

  it('an unknown dashboard type still falls back to default', () => {
    expect(apiRoleForType('some_unknown_type')).toBe('default')
  })
})
