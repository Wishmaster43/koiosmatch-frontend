/**
 * KPI-DREMPELS-FE-1 + NOTIF-CONTEXTEN-FE-1 registry wiring — the four new settings
 * sub-tabs the two backend contracts call for: two 'kpis' schema tabs (English
 * slugs kpis_opportunities/kpis_vacancies) and two 'notifications' render tabs
 * (English slugs notif_calllists/notif_opportunities, context prop matches the
 * backend's own English context keys 1:1 — CMBE 23-08).
 */
import { describe, it, expect } from 'vitest'
import { Bell } from 'lucide-react'
import { NAV_GROUPS } from './registry'
import { kpisOpportunities, kpisVacancies } from './schemas/kpis'

describe('registry — kpis_opportunities / kpis_vacancies (KPI-DREMPELS-FE-1)', () => {
  const kpisGroup = NAV_GROUPS.find((g) => g.key === 'kpis')

  it('registers kpis_opportunities with the kpisOpportunities schema', () => {
    const item = kpisGroup?.items.find((i) => i.id === 'kpis_opportunities')
    expect(item?.schema).toBe(kpisOpportunities)
  })

  it('registers kpis_vacancies with the kpisVacancies schema', () => {
    const item = kpisGroup?.items.find((i) => i.id === 'kpis_vacancies')
    expect(item?.schema).toBe(kpisVacancies)
  })
})

describe('registry — notif_calllists / notif_opportunities (NOTIF-CONTEXTEN-FE-1)', () => {
  const notifGroup = NAV_GROUPS.find((g) => g.key === 'notifications')

  it('renders NotificationsSettings with context="calllists"', () => {
    const item = notifGroup?.items.find((i) => i.id === 'notif_calllists')
    expect(item?.render?.().props.context).toBe('calllists')
  })

  it('renders NotificationsSettings with context="opportunities"', () => {
    const item = notifGroup?.items.find((i) => i.id === 'notif_opportunities')
    expect(item?.render?.().props.context).toBe('opportunities')
  })

  // SETTINGS-TABS-FIX-1 review: every row in this group reads Bell — a
  // per-context icon (Phone/Target) made the notifications list read as
  // several different lists instead of one.
  it('uses the shared Bell icon, matching every sibling row in the group', () => {
    const calllists = notifGroup?.items.find((i) => i.id === 'notif_calllists')
    const opportunities = notifGroup?.items.find((i) => i.id === 'notif_opportunities')
    expect(calllists?.icon).toBe(Bell)
    expect(opportunities?.icon).toBe(Bell)
  })
})
