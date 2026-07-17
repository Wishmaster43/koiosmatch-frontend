import { describe, it, expect } from 'vitest'
import { mapVacancy, mapVacancyDetail } from './mapVacancy'

describe('mapVacancy', () => {
  it('maps a snake_case API row with nested objects', () => {
    const row = mapVacancy({
      id: 'v1', code: '00107', title: 'Verpleegkundige | Den Haag',
      status: { value: 'open', label: 'Open', color: '#79B58E' },
      leads_count: 5, applications_count: 12, published: true,
      owner: { id: 'u1', name: 'Kelly van Vliet', avatar_color: '#abc' },
      customer: { id: 'c1', name: 'Yesway zorg' },
      tags: ['zorg'], created_at: '2026-06-16',
    })
    expect(row).toMatchObject({
      id: 'v1', code: '00107', statusValue: 'open', statusLabel: 'Open', statusColor: '#79B58E',
      leadsCount: 5, applicationsCount: 12, published: true,
      clientId: 'c1', clientName: 'Yesway zorg',
    })
    expect(row.owner).toMatchObject({ id: 'u1', name: 'Kelly van Vliet', initials: 'KV', color: '#abc' })
  })

  it('derives the applications total from the per-phase breakdown when no count is given', () => {
    const row = mapVacancy({ id: 'v2', applications_by_phase: { applied: 3, hired: 1, rejected: 2 } })
    expect(row.applicationsCount).toBe(6)
    expect(row.applicationsByPhase).toEqual({ applied: 3, hired: 1, rejected: 2 })
  })

  it('never throws on an empty record and fills safe defaults', () => {
    const row = mapVacancy({})
    expect(row.title).toBe('—')
    expect(row.published).toBe(false)
    expect(row.leadsCount).toBe(0)
    expect(row.applicationsCount).toBe(0)
    expect(row.owner.initials).toBe('?')
  })
})

describe('mapVacancyDetail', () => {
  it('normalises lookups, channels and coupled applications', () => {
    const detail = mapVacancyDetail({
      id: 'v1', title: 'Test',
      contract_types: ['freelance', 'payroll'],
      seniority: { label: 'Professional' }, education: 'MBO',
      salary_min: 2500, salary_max: 3200, salary_period: 'p/m',
      application_settings: { cv: 'required' },
      channels: [{ value: 'career', label: 'Carrière-pagina', published: true }],
      applications: [{ id: 'a1', candidate: { id: 'c1', name: 'Rosa Tijssen' }, phase: { value: 'hired', label: 'Aangenomen', color: '#79B58E' }, source: 'Werkzoeken' }],
    })
    expect(detail.contractTypes).toEqual(['freelance', 'payroll'])
    expect(detail.seniority).toBe('Professional')
    expect(detail.education).toBe('MBO')
    expect(detail.salary).toBe('2500 – 3200 p/m')
    expect(detail.applicationSettings).toEqual({ cv: 'required' })
    expect(detail.channels[0]).toMatchObject({ value: 'career', published: true })
    expect(detail.applications[0]).toMatchObject({ candidateName: 'Rosa Tijssen', candidateInitials: 'RT', phaseValue: 'hired' })
  })

  // CHANNEL-ICON-1: the merged channel's stable key + icon ride along so
  // channelIcons.ts can map exactly instead of heuristically matching the label.
  it('carries the channel key + icon through', () => {
    const detail = mapVacancyDetail({
      id: 'v1', title: 'Test',
      channels: [{ value: 'ch1', key: 'indeed', icon: 'briefcase', label: 'Indeed', published: true }],
    })
    expect(detail.channels[0]).toMatchObject({ key: 'indeed', icon: 'briefcase', published: true })
  })

  it('never crashes when a channel has no key/icon yet (pre-CHANNEL-ICON-1 row)', () => {
    const detail = mapVacancyDetail({ id: 'v1', channels: [{ value: 'ch1', label: 'Indeed', published: false }] })
    expect(detail.channels[0].key).toBeUndefined()
    expect(detail.channels[0].icon).toBeUndefined()
  })

  // VAC-CASCADE-1 (backend wave 6): the persisted klant → locatie → afdeling →
  // contactpersoon cascade — ids + resolved {id,name} seed the in-place editor.
  it('seeds the customer cascade ids + resolved names from the detail', () => {
    const detail = mapVacancyDetail({
      id: 'v1', title: 'Test',
      customer_location_id: 'loc1', customer_location: { id: 'loc1', name: 'Locatie Assen' },
      customer_department_id: 'dep1', customer_department: { id: 'dep1', name: 'Afdeling A' },
      contact_id: 'con1', contact: { id: 'con1', name: 'Petra de Boer' },
    })
    expect(detail).toMatchObject({
      customerLocationId: 'loc1', customerLocationName: 'Locatie Assen',
      customerDepartmentId: 'dep1', customerDepartmentName: 'Afdeling A',
      contactId: 'con1', contactName: 'Petra de Boer',
    })
  })

  it('the customer cascade defaults to empty strings when never picked', () => {
    const detail = mapVacancyDetail({ id: 'v1' })
    expect(detail).toMatchObject({
      customerLocationId: '', customerLocationName: '',
      customerDepartmentId: '', customerDepartmentName: '',
      contactId: '', contactName: '',
    })
  })
})
