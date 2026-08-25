/**
 * ApplicationDetailsCard — the framed Details block (Danny 25-07 c: Bron/Klant/
 * Locatie/Vacature used to float without a card, unlike Motivatie right below
 * it). Covers: the fields render, the shared pencil opens the edit inputs and
 * saving calls both callbacks, the Klantlocatie/Afdeling/Contactpersoon rows
 * (VAC-CASCADE-MIRROR-1, 05-08: sourced from the linked vacancy's OWN detail —
 * present with a phone/email second line on Contactpersoon, and a dash when the
 * vacancy has none/is not yet loaded — never crash), and the APP-MATCH-SUMMARY-1
 * Match row (link + status chip + match period, rendered ONLY when the
 * application actually carries a match — never a dash row for an absent
 * relation).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationDetailsCard from './ApplicationDetailsCard'
import type { ApplicationDetail } from '@/types/application'
import type { VacancyDetail } from '@/types/vacancy'

// Key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) — avoids the real
// i18n instance's async-init timing flipping assertions between raw keys and
// translated NL copy depending on run order. Falls back to `opts.defaultValue`
// (repo-wide precedent, e.g. NoteKoiosModeToggle.test.tsx) so a LOOKUP-I18N-1
// seed-translation call (`t(key, { defaultValue })`) still echoes the untranslated
// seed name instead of the raw i18n key.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
// useDateFormat imports @/i18n, which needs a REAL react-i18next to initialise —
// stub the whole module (mirrors ApplicationStatusStrip.test.tsx) so nothing
// here touches the real singleton.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (d: unknown) => (d ? String(d) : '—'), formatDateTime: (d: unknown) => (d ? String(d) : '—') }),
  useLocale: () => 'nl-NL',
}))

// The vacancy-link edit mode (useVacancyLinkOptions) fetches /vacancies — stub
// the client so this file only tests the card's own wiring.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
  // S-SOURCE-1 GRADUATED 2026-08-14: useApplicationSources reads the real
  // /candidate-sources lookup through this same shared unwrap — mirrors the real
  // helper's "unwrap the .data envelope" shape.
  unwrap: (res: { data?: { data?: unknown } }) => res?.data?.data ?? res?.data,
  getActiveTenantId: () => 'tenant-1',
}))
import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// VAC-CASCADE-MIRROR-1: mock the shared hook directly (repo precedent —
// CompetitionBlock.test.tsx) — this file tests ApplicationDetailsCard's own
// wiring, not useApplicationVacancy's React Query fetch (tested elsewhere).
const mockUseApplicationVacancy = vi.fn()
vi.mock('../hooks/useApplicationVacancy', () => ({
  useApplicationVacancy: (id: unknown) => mockUseApplicationVacancy(id),
}))

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, source: 'Facebook', client: 'Yesway', vacancyTitle: 'Verpleegkundige', vacancyId: null,
  contact: null,
  match: null,
  ...over,
} as unknown as ApplicationDetail)

// VAC-CASCADE-MIRROR-1: the linked vacancy's full detail (only the fields this
// card reads — clientId/customerLocationName/customerDepartmentName/contactName).
const vac = (over: Partial<VacancyDetail> = {}) => ({
  clientId: 'cust-1', customerLocationName: '', customerDepartmentName: '', contactName: '',
  ...over,
} as unknown as VacancyDetail)

describe('ApplicationDetailsCard', () => {
  // VAC-CASCADE-MIRROR-1: default = no vacancy detail resolved yet (loading or
  // nothing linked) — the three cascade rows must fall back to a dash, never crash.
  beforeEach(() => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: null, loading: false, error: false })
  })

  it('renders the core fields (Bron/Klant/Vacature)', () => {
    render(<ApplicationDetailsCard application={app()} />)
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('drawer.detailsTitle')).toBeInTheDocument()
  })

  it('renders Klantlocatie/Afdeling/Contactpersoon from the linked vacancy detail (VAC-CASCADE-MIRROR-1)', () => {
    mockUseApplicationVacancy.mockReturnValue({
      vacancy: vac({ customerLocationName: 'Rivas Zorggroep — Den Haag', customerDepartmentName: 'Dagbesteding', contactName: 'Daan Jansen' }),
      loading: false, error: false,
    })
    render(<ApplicationDetailsCard application={app()} />)
    expect(screen.getByText('vacancies:details.customerLocation')).toBeInTheDocument()
    expect(screen.getByText('Rivas Zorggroep — Den Haag')).toBeInTheDocument()
    expect(screen.getByText('vacancies:details.customerDepartment')).toBeInTheDocument()
    expect(screen.getByText('Dagbesteding')).toBeInTheDocument()
    expect(screen.getByText('Daan Jansen')).toBeInTheDocument()
  })

  it('renders a dash for Klantlocatie/Afdeling/Contactpersoon while the vacancy detail has not resolved (never fabricated)', () => {
    render(<ApplicationDetailsCard application={app()} />)
    expect(screen.getByText('vacancies:details.customerLocation')).toBeInTheDocument()
    expect(screen.getByText('vacancies:details.customerDepartment')).toBeInTheDocument()
    expect(screen.getByText('vacancies:details.contactPerson')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('opens the pencil into edit mode, picks a source from the searchable picker, and calls both callbacks on save (S-SOURCE-1)', async () => {
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.resolve({ data: { data: [{ id: 'v2', title: 'Chirurg', client_name: 'Acme' }] } })
      : Promise.resolve({ data: [] }))
    const onLinkVacancy = vi.fn()
    const onUpdateSource = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationDetailsCard application={app()} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />)

    await user.click(screen.getByLabelText('common:edit'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/vacancies', { params: { per_page: 100 } }))

    // Source is now a searchable picker (not a bare input) — its trigger shows the
    // application's current (possibly non-conforming) value, "Facebook", even though
    // that value is not one of the seeded picker options — never silently dropped.
    const sourceTrigger = screen.getByRole('button', { name: 'Facebook' })
    await user.click(sourceTrigger)
    const search = screen.getByPlaceholderText('drawer.source')
    await user.type(search, 'LinkedIn')
    await user.click(screen.getByRole('button', { name: 'LinkedIn' }))
    await user.click(screen.getByLabelText('common:save'))

    expect(onLinkVacancy).toHaveBeenCalledWith(1, null, { title: undefined, client: undefined })
    expect(onUpdateSource).toHaveBeenCalledWith(1, 'LinkedIn')
  })

  it('clears the source picker back to empty (optional field, VAC-CLEAR-1)', async () => {
    const onUpdateSource = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationDetailsCard application={app()} onUpdateSource={onUpdateSource} />)
    await user.click(screen.getByLabelText('common:edit'))
    await user.click(screen.getByTitle('clearField'))
    await user.click(screen.getByLabelText('common:save'))
    expect(onUpdateSource).toHaveBeenCalledWith(1, '')
  })

  it('cancels the edit without calling either callback', async () => {
    const onLinkVacancy = vi.fn()
    const onUpdateSource = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationDetailsCard application={app()} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />)
    await user.click(screen.getByLabelText('common:edit'))
    await user.click(screen.getByLabelText('common:cancel'))
    expect(onLinkVacancy).not.toHaveBeenCalled()
    expect(onUpdateSource).not.toHaveBeenCalled()
  })

  it('renders the contact person (from the vacancy detail) with a phone/email second line (from the application resource) when present', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ contactName: 'Marieke Jansen' }), loading: false, error: false })
    render(<ApplicationDetailsCard application={app({ contact: { id: 'c1', name: 'Marieke Jansen', email: 'marieke@example.com', phone: '0612345678' } })} />)
    expect(screen.getByText('Marieke Jansen')).toBeInTheDocument()
    expect(screen.getByText('0612345678 · marieke@example.com')).toBeInTheDocument()
  })

  it('renders a dash and does not crash when there is no contact', () => {
    render(<ApplicationDetailsCard application={app({ contact: null })} />)
    expect(screen.getByText('vacancies:details.contactPerson')).toBeInTheDocument()
  })

  it('never shows a stale application-level contact name/phone when the vacancy detail itself has no contact (the vacancy detail is the source of truth)', () => {
    render(<ApplicationDetailsCard application={app({ contact: { id: 'c1', name: 'Stale Name', email: 'stale@example.com', phone: '0600000000' } })} />)
    expect(screen.queryByText('Stale Name')).toBeNull()
    expect(screen.queryByText(/0600000000/)).toBeNull()
  })

  it('renders the Match row with its reference/status/match period when a match exists', () => {
    render(<ApplicationDetailsCard application={app({
      match: {
        id: 'm1', referenceNumber: 'M-00042', statusLabel: 'Active',
        // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup colour), not a UI colour choice
        statusColor: '#79B58E',
        matchStart: '2026-08-01', matchEnd: '2026-09-01',
      },
    })} />)
    expect(screen.getByText('M-00042')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('drawer.placementPeriod')).toBeInTheDocument()
  })

  it('shows the ongoing match label when the match has no end date', () => {
    render(<ApplicationDetailsCard application={app({
      match: {
        id: 'm2', referenceNumber: 'M-00043', statusLabel: 'Active',
        // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup colour), not a UI colour choice
        statusColor: '#79B58E',
        matchStart: '2026-08-01', matchEnd: null,
      },
    })} />)
    expect(screen.getByText('drawer.placementPeriod')).toBeInTheDocument()
  })

  it('renders NOTHING for the Match row when the application has no match', () => {
    render(<ApplicationDetailsCard application={app({ match: null })} />)
    expect(screen.queryByText(/drawer\.match/)).toBeNull()
    expect(screen.queryByText(/drawer\.placementPeriod/)).toBeNull()
  })
})
