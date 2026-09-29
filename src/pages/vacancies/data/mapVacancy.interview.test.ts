/**
 * mapVacancy · applicants[].interview — INTERVIEW-VISIBILITY-1: the vacancy
 * drawer's Applicants tab needs the same interview-progress shape the
 * applications table renders, tolerant of a backend that doesn't attach it yet.
 */
import { describe, it, expect } from 'vitest'
import { mapVacancyDetail } from './mapVacancy'

describe('mapVacancyDetail · applications[].interview (INTERVIEW-VISIBILITY-1)', () => {
  it('maps undefined when the backend does not send the `interview` key on the applicant row at all', () => {
    const detail = mapVacancyDetail({ id: 'v-1', applications: [{ id: 'app-1', candidate: { id: 'c-1', name: 'Jan' } }] })
    expect(detail.applications[0].interview).toBeUndefined()
  })

  it('maps null when the applicant carries an explicit null interview session', () => {
    const detail = mapVacancyDetail({ id: 'v-1', applications: [{ id: 'app-1', candidate: { id: 'c-1', name: 'Jan' }, interview: null }] })
    expect(detail.applications[0].interview).toBeNull()
  })

  it('maps category/step/total/turn/waiting_since when present', () => {
    const detail = mapVacancyDetail({
      id: 'v-1',
      applications: [{
        id: 'app-1', candidate: { id: 'c-1', name: 'Jan' },
        interview: { category: 'busy', current_status: 'ACTIVE', step: 2, total: 5, turn: 'candidate', waiting_since: '2026-09-29T09:00:00Z' },
      }],
    })
    expect(detail.applications[0].interview).toMatchObject({
      category: 'busy', currentStatus: 'ACTIVE', step: 2, total: 5, turn: 'candidate', waitingSince: '2026-09-29T09:00:00Z',
    })
  })

  it('only accepts the candidate/agent vocabulary — an unknown value maps to null, never rendered raw', () => {
    const detail = mapVacancyDetail({
      id: 'v-1',
      applications: [{ id: 'app-1', candidate: { id: 'c-1' }, interview: { category: 'busy', turn: 'something_else' } }],
    })
    expect(detail.applications[0].interview?.turn).toBeNull()
  })
})
