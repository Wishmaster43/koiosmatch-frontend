/**
 * ApplicationDetailsCard — the framed Details block (Danny 25-07 c: Bron/Klant/
 * Locatie/Vacature used to float without a card, unlike Motivatie right below
 * it). Covers: the four existing fields render, the shared pencil opens the
 * edit inputs and saving calls both callbacks, the Contactpersoon row (present
 * with a phone/email second line, and a dash when absent — never crash), and
 * the APP-MATCH-SUMMARY-1 Match row (link + status chip + match period,
 * rendered ONLY when the application actually carries a match — never a dash
 * row for an absent relation).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationDetailsCard from './ApplicationDetailsCard'
import type { ApplicationDetail } from '@/types/application'

// Key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) — avoids the real
// i18n instance's async-init timing flipping assertions between raw keys and
// translated NL copy depending on run order.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
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
}))
import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, source: 'Facebook', client: 'Yesway', vacancyTitle: 'Verpleegkundige',
  vacancy: { id: null, title: '', client: 'Yesway', vacancyId: '', status: '',
    employmentType: '', location: 'Utrecht', salary: '', hours: '', experience: '', seniority: '',
    education: '', branch: '', category: '', skills: [], tags: [] },
  contact: null,
  match: null,
  ...over,
} as unknown as ApplicationDetail)

describe('ApplicationDetailsCard', () => {
  it('renders the four existing fields (Bron/Klant/Locatie/Vacature)', () => {
    render(<ApplicationDetailsCard application={app()} />)
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('drawer.detailsTitle')).toBeInTheDocument()
  })

  it('opens the pencil into edit mode and calls both callbacks on save', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'v2', title: 'Chirurg', client_name: 'Acme' }] } })
    const onLinkVacancy = vi.fn()
    const onUpdateSource = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationDetailsCard application={app()} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />)

    await user.click(screen.getByLabelText('common:edit'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/vacancies', { params: { per_page: 100 } }))
    const sourceInput = screen.getByDisplayValue('Facebook')
    await user.clear(sourceInput)
    await user.type(sourceInput, 'LinkedIn')
    await user.click(screen.getByLabelText('common:save'))

    expect(onLinkVacancy).toHaveBeenCalledWith(1, null, { title: undefined, client: undefined })
    expect(onUpdateSource).toHaveBeenCalledWith(1, 'LinkedIn')
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

  it('renders the contact person with a phone/email second line when present', () => {
    render(<ApplicationDetailsCard application={app({ contact: { id: 'c1', name: 'Marieke Jansen', email: 'marieke@example.com', phone: '0612345678' } })} />)
    expect(screen.getByText('Marieke Jansen')).toBeInTheDocument()
    expect(screen.getByText('0612345678 · marieke@example.com')).toBeInTheDocument()
  })

  it('renders a dash and does not crash when there is no contact', () => {
    render(<ApplicationDetailsCard application={app({ contact: null })} />)
    expect(screen.getByText('drawer.contactPerson')).toBeInTheDocument()
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
