/**
 * mapVacancyDetail — the per-phase application counts (V25, measured 02-09):
 * VacancyController::show() attaches applications_by_phase since 2e110914 and
 * those attached counts win; the derivation from raw.applications is only the
 * belt-and-braces fallback that keeps the Statistieken tab honest if a backend
 * regression ever drops the attached field again.
 */
import { describe, it, expect } from 'vitest'
import { mapVacancyDetail } from './mapVacancy'

describe('mapVacancyDetail · applications_by_phase', () => {
  it('uses the attached counts when the backend sends them', () => {
    const v = mapVacancyDetail({ id: 'v1', applications_by_phase: { applied: 2 }, applications: [{ phase: { value: 'applied' } }, { phase: { value: 'hired' } }] } as never)
    expect(v.applicationsByPhase).toEqual({ applied: 2 })
  })

  it('falls back to deriving the counts from the coupled applications when nothing is attached', () => {
    const v = mapVacancyDetail({ id: 'v1', applications: [{ phase: { value: 'applied' } }, { phase: { value: 'hired' } }, { phase: { value: 'applied' } }] } as never)
    expect(v.applicationsByPhase).toEqual({ applied: 2, hired: 1 })
    expect(v.applicationsCount).toBe(3)
  })
})
