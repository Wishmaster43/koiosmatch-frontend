/**
 * DASH-HOURS server-first pin (BE 4b320105): the hours-mode pipeline tile reads
 * the PINNED dashboard-KPI `pipeline_hours` first; the raw opp feed is only the
 * tolerant fallback for a cached pre-key envelope (§10).
 */
import { describe, it, expect } from 'vitest'
import { buildDashboardKpis } from './dashboardKpis'

const t = (k: string) => k
const num = (v?: number | null) => String(v)
const eur = (v?: unknown) => `€${v}`

const base = { t, num, eur, drills: {}, onNavigate: undefined } as never

describe('pipeline tile — hours mode', () => {
  it('prefers the pinned server KPI over the raw opp feed', () => {
    const out = buildDashboardKpis({ ...(base as object), valueInHours: true,
      kpis: { pipeline_hours: 128 } as never, opp: { pipeline_hours: 999 } } as never)
    expect(out.pipeline.value).toBe('128')
  })

  it('falls back to the raw opp feed only when the pinned key is absent (cached pre-key envelope)', () => {
    const out = buildDashboardKpis({ ...(base as object), valueInHours: true,
      kpis: {} as never, opp: { pipeline_hours: 42 } } as never)
    expect(out.pipeline.value).toBe('42')
  })

  it('renders the house dash when neither carries a value', () => {
    const out = buildDashboardKpis({ ...(base as object), valueInHours: true,
      kpis: {} as never, opp: null } as never)
    expect(out.pipeline.value).toBe('\u2014')
  })
})
