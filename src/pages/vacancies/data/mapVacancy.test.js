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

  // VAC-DATES-1: start_date/end_date now ship on the list resource too (both
  // already YYYY-MM-DD via Carbon::toDateString(), the exact <input type="date"> shape).
  it('maps the runtime window (start_date/end_date)', () => {
    const row = mapVacancy({ id: 'v3', start_date: '2026-01-01', end_date: '2026-06-30' })
    expect(row.startDate).toBe('2026-01-01')
    expect(row.endDate).toBe('2026-06-30')
  })

  it('defaults startDate/endDate to empty strings when never set', () => {
    const row = mapVacancy({ id: 'v4' })
    expect(row.startDate).toBe('')
    expect(row.endDate).toBe('')
  })

  // Archive state: VacancyListResource always sends both `archived` (bool) and
  // `deleted_at` (iso) — mirror candidates so the include_archived=1 view can
  // render the soft "Gearchiveerd" chip.
  it('maps the archive state from the resource\'s own `archived` flag', () => {
    const row = mapVacancy({ id: 'v5', archived: true, deleted_at: '2026-07-01T10:00:00Z' })
    expect(row.archived).toBe(true)
    expect(row.archivedAt).toBe('2026-07-01T10:00:00Z')
  })

  it('derives archived from deleted_at when the archived flag is absent (defensive)', () => {
    const row = mapVacancy({ id: 'v6', deleted_at: '2026-07-01T10:00:00Z' })
    expect(row.archived).toBe(true)
  })

  it('defaults to not-archived / null archivedAt on a live vacancy', () => {
    const row = mapVacancy({ id: 'v7' })
    expect(row.archived).toBe(false)
    expect(row.archivedAt).toBeNull()
  })

  // VAC-AGENT-1: the linked AI agent (Option A — linking IS the interview toggle
  // for this vacancy) ships as a nested object + a flat interview_flow_id.
  it('maps the linked AI agent + its interview flow id', () => {
    const row = mapVacancy({ id: 'v8', ai_agent: { id: 'agent1', name: 'Intake bot' }, interview_flow_id: 'flow1' })
    expect(row.aiAgentId).toBe('agent1')
    expect(row.aiAgentName).toBe('Intake bot')
    expect(row.interviewFlowId).toBe('flow1')
  })

  it('defaults to no linked agent when none is set', () => {
    const row = mapVacancy({ id: 'v9' })
    expect(row.aiAgentId).toBeNull()
    expect(row.aiAgentName).toBe('')
    expect(row.interviewFlowId).toBeNull()
  })

  it('falls back to a flat ai_agent_id when no nested object is sent', () => {
    const row = mapVacancy({ id: 'v10', ai_agent_id: 'agent2' })
    expect(row.aiAgentId).toBe('agent2')
    expect(row.aiAgentName).toBe('')
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

  // V25 (VACATURES-100): GET /vacancies/{id} never attaches applications_by_phase/
  // applications_count (VacancyController::show() has no attachApplicationCounts()
  // call — only index() does), so the Statistics tab + the Sollicitaties tab's
  // per-phase chips came back empty for every real vacancy. The full coupled-
  // applications list IS loaded on the detail endpoint, so mapVacancyDetail derives
  // the same counts from it when the attached fields are missing.
  it('derives applicationsByPhase/applicationsCount from raw.applications when the detail response never attached them', () => {
    const detail = mapVacancyDetail({
      id: 'v1', title: 'Test',
      // No applications_by_phase/applications_count on this raw payload — mirrors
      // the real GET /vacancies/{id} response.
      applications: [
        { id: 'a1', phase: { value: 'applied' } },
        { id: 'a2', phase: { value: 'applied' } },
        { id: 'a3', phase: { value: 'hired' } },
      ],
    })
    expect(detail.applicationsByPhase).toEqual({ applied: 2, hired: 1 })
    expect(detail.applicationsCount).toBe(3)
  })

  it('prefers the attached applications_by_phase/applications_count when the backend DID send them (e.g. a future show() fix)', () => {
    const detail = mapVacancyDetail({
      id: 'v1', title: 'Test',
      applications_by_phase: { applied: 10 }, applications_count: 10,
      applications: [{ id: 'a1', phase: { value: 'hired' } }],
    })
    // The attached (real, server-computed) counts win over the applications-array derivation.
    expect(detail.applicationsByPhase).toEqual({ applied: 10 })
    expect(detail.applicationsCount).toBe(10)
  })

  it('never crashes when there are no applications and no attached counts', () => {
    const detail = mapVacancyDetail({ id: 'v1' })
    expect(detail.applicationsByPhase).toEqual({})
    expect(detail.applicationsCount).toBe(0)
  })

  // VAC-COUNTRY-1 (Danny 22-07, punt 2): land→provincie cascade — the DB column
  // is location_country/location_province (create_vacancy_table r131-132); read
  // that raw name first, falling back to the already-mapped key the resource
  // sends today for province.
  it('maps country/province from the raw location_* column names', () => {
    const detail = mapVacancyDetail({ id: 'v1', location_country: 'NL', location_province: 'Utrecht' })
    expect(detail.country).toBe('NL')
    expect(detail.province).toBe('Utrecht')
  })

  it('falls back to the already-mapped province key when location_province is absent', () => {
    const detail = mapVacancyDetail({ id: 'v1', province: 'Zuid-Holland' })
    expect(detail.province).toBe('Zuid-Holland')
  })

  it('defaults country to an empty string — honest about the BE gap, never crashes', () => {
    const detail = mapVacancyDetail({ id: 'v1' })
    expect(detail.country).toBe('')
  })
})
