import type { ReactElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ApplicationTab from './ApplicationTab'
import { peekReturnTab } from './constants'
import type { ApplicationDetail } from '@/types/application'

// Deterministic key-echo (repo-wide precedent, e.g. AddShiftModal.test.tsx) —
// without it, i18n's real (async-initialising) instance can finish loading
// mid-file once anything here awaits a promise (S31's real QueryClient does),
// flipping later assertions from raw keys to actual NL copy.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// S31: CvBlock's useDateFormat (@/lib/datetime) imports `@/i18n`, which needs a
// REAL react-i18next (initReactI18next) to initialise — stub the whole module
// instead so nothing in this file ever imports the real i18n singleton.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (d: unknown) => (d ? String(d) : '—'), formatDateTime: (d: unknown) => (d ? String(d) : '—') }),
  useLocale: () => 'nl-NL',
}))

// RejectionBlock fetches the reasons on mount; the vacancy-link edit mode
// (useVacancyLinkOptions) fetches /vacancies; S31's CvBlock fetches the linked
// candidate's documents via React Query — stub the client so this file only
// tests ApplicationTab's own wiring, not any dependency's internals.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))
import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// S31: CvBlock's useCandidateCvDocument needs a QueryClientProvider in the tree.
const renderTab = (ui: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

// Minimal application detail for the read-only "Sollicitatie" tab. `vacancy` is a
// required nested object on the real type (mapApplicationDetail always builds one) —
// included here too so ApplicationTab's Locatie field (S6) doesn't read undefined.
// vacancyId stays unset by default (mirrors the original fixture — several tests
// below rely on the vacancy-link edit mode starting from "no vacancy picked").
const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, source: 'Facebook', client: 'Yesway', vacancyTitle: 'Verpleegkundige',
  bucket: 'active', score: null, matchCriteria: [], ai: {},
  vacancy: { id: null, title: '', client: 'Yesway', vacancyId: '', status: '',
    employmentType: '', location: '', salary: '', hours: '', experience: '', seniority: '',
    education: '', branch: '', category: '', skills: [], tags: [] },
  ...over,
} as unknown as ApplicationDetail)

describe('ApplicationTab', () => {
  it('renders the read-only details (source/client/vacancy), no repeated heading', () => {
    renderTab(<ApplicationTab application={app()} />)
    // S3: the redundant "Details" heading is gone — only the pencil marks the block.
    expect(screen.queryByText('drawer.details')).toBeNull()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })

  it('shows the rejection block for an active application', () => {
    renderTab(<ApplicationTab application={app()} />)
    expect(screen.getByText('rejection.title')).toBeInTheDocument()
  })

  it('hides the rejection block once the application is a match', () => {
    renderTab(<ApplicationTab application={app({ bucket: 'matched' })} />)
    expect(screen.queryByText('rejection.title')).toBeNull()
  })

  it('hides the Details edit pencil when onLinkVacancy is not provided', () => {
    renderTab(<ApplicationTab application={app()} />)
    expect(screen.queryByLabelText('common:edit')).toBeNull()
  })

  it('opens the vacancy picker in edit mode, showing a diskette + cancel', async () => {
    const user = userEvent.setup()
    renderTab(<ApplicationTab application={app()} onLinkVacancy={vi.fn()} />)
    await user.click(screen.getByLabelText('common:edit'))
    expect(screen.getByLabelText('common:save')).toBeInTheDocument()
    expect(screen.getByLabelText('common:cancel')).toBeInTheDocument()
    // The read-only vacancy value is replaced by the picker while editing.
    expect(screen.queryByText('Verpleegkundige')).toBeNull()
  })

  it('cancels the edit without calling onLinkVacancy', async () => {
    const onLinkVacancy = vi.fn()
    const user = userEvent.setup()
    renderTab(<ApplicationTab application={app()} onLinkVacancy={onLinkVacancy} />)
    await user.click(screen.getByLabelText('common:edit'))
    await user.click(screen.getByLabelText('common:cancel'))
    expect(screen.queryByLabelText('common:save')).toBeNull()
    expect(onLinkVacancy).not.toHaveBeenCalled()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })

  it('picks a vacancy option and saves via the shared onLinkVacancy handler', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'v2', title: 'Chirurg', client_name: 'Acme' }] } })
    const onLinkVacancy = vi.fn()
    const user = userEvent.setup()
    renderTab(<ApplicationTab application={app()} onLinkVacancy={onLinkVacancy} />)

    await user.click(screen.getByLabelText('common:edit'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/vacancies', { params: { per_page: 100 } }))
    // Open the searchable select (starts on the "no vacancy" entry) and pick the loaded option.
    await user.click(screen.getByRole('button', { name: 'drawer.noVacancy' }))
    await waitFor(() => screen.getByRole('button', { name: 'Chirurg · Acme' }))
    await user.click(screen.getByRole('button', { name: 'Chirurg · Acme' }))
    await user.click(screen.getByLabelText('common:save'))

    expect(onLinkVacancy).toHaveBeenCalledWith(1, 'v2', { title: 'Chirurg', client: 'Acme' })
  })

  // S12/S13: the read-only vacancy value is a real EntityLink (in-app click + new-tab
  // icon), not plain text, once a vacancy is actually linked.
  it('renders the linked vacancy as a clickable EntityLink', () => {
    renderTab(<ApplicationTab application={app({ vacancyId: 'v9', vacancyTitle: 'Chirurg' })} />)
    expect(screen.getByTitle('drawer.openVacancy')).toBeInTheDocument()
  })

  // S12/S13: Klant becomes a real EntityLink once the application carries a
  // customer_id (the vacancy's client) — plain text otherwise (no id to link to).
  it('renders Klant as a clickable EntityLink once customerId is present', () => {
    renderTab(<ApplicationTab application={app({ customerId: 'cust1' })} />)
    expect(screen.getByTitle('drawer.openCustomer')).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
  })

  it('renders Klant as plain text when no customerId is present', () => {
    renderTab(<ApplicationTab application={app()} />)
    expect(screen.queryByTitle('drawer.openCustomer')).toBeNull()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
  })

  // S7: Bron is editable in-place, sharing the Details block's pencil with the
  // vacancy link — same save/cancel affordance, separate PATCH via onUpdateSource.
  describe('Bron field (S7)', () => {
    it('shows the Details pencil when only onUpdateSource is provided (no onLinkVacancy)', () => {
      renderTab(<ApplicationTab application={app()} onUpdateSource={vi.fn()} />)
      expect(screen.getByLabelText('common:edit')).toBeInTheDocument()
    })

    it('edits Bron in place and calls onUpdateSource with the new value on save', async () => {
      const onUpdateSource = vi.fn()
      const user = userEvent.setup()
      renderTab(<ApplicationTab application={app({ id: 5 })} onUpdateSource={onUpdateSource} />)
      await user.click(screen.getByLabelText('common:edit'))
      const sourceInput = screen.getByDisplayValue('Facebook')
      await user.clear(sourceInput)
      await user.type(sourceInput, 'LinkedIn')
      await user.click(screen.getByLabelText('common:save'))
      expect(onUpdateSource).toHaveBeenCalledWith(5, 'LinkedIn')
    })

    it('does not call onUpdateSource when Bron is unchanged', async () => {
      const onUpdateSource = vi.fn()
      const user = userEvent.setup()
      renderTab(<ApplicationTab application={app()} onUpdateSource={onUpdateSource} />)
      await user.click(screen.getByLabelText('common:edit'))
      await user.click(screen.getByLabelText('common:save'))
      expect(onUpdateSource).not.toHaveBeenCalled()
    })

    it('cancels without calling onUpdateSource', async () => {
      const onUpdateSource = vi.fn()
      const user = userEvent.setup()
      renderTab(<ApplicationTab application={app()} onUpdateSource={onUpdateSource} />)
      await user.click(screen.getByLabelText('common:edit'))
      const sourceInput = screen.getByDisplayValue('Facebook')
      await user.clear(sourceInput)
      await user.type(sourceInput, 'LinkedIn')
      await user.click(screen.getByLabelText('common:cancel'))
      expect(onUpdateSource).not.toHaveBeenCalled()
      expect(screen.getByText('Facebook')).toBeInTheDocument()
    })
  })

  // S14/S22: clicking through to the full vacancy stashes 'application' as the
  // return tab, so browser BACK reopens this application's drawer on Sollicitatie.
  it('stashes the return tab before navigating to the linked vacancy', async () => {
    const user = userEvent.setup()
    renderTab(<ApplicationTab application={app({ id: 77, vacancyId: 'v9', vacancyTitle: 'Chirurg' })} />)
    await user.click(screen.getByTitle('drawer.openVacancy'))
    expect(peekReturnTab(77)).toBe('application')
  })

  // S31 (refined 21-07): compact Ja/Nee CV indicator, reusing the candidate
  // Documents section's download + DocPreviewModal preview affordance.
  describe('CV block (S31)', () => {
    it('shows Nee when the candidate has no CV', async () => {
      renderTab(<ApplicationTab application={app({ candidateId: 'c1' })} />)
      expect(await screen.findByText('common:no')).toBeInTheDocument()
      expect(screen.queryByLabelText('drawer.cv.download')).toBeNull()
      expect(screen.queryByLabelText('drawer.cv.view')).toBeNull()
    })

    it('shows Ja with a download + preview icon pair when a CV exists', async () => {
      mockGet.mockImplementation((url: string) => String(url).includes('/documents')
        ? Promise.resolve({ data: { data: [{ id: 'd1', name: 'cv-anna.pdf', type: 'CV', url: 'https://files.example/cv-anna.pdf', created_at: '2026-07-01T10:00:00Z' }] } })
        : Promise.resolve({ data: [] }))
      renderTab(<ApplicationTab application={app({ candidateId: 'c1' })} />)
      expect(await screen.findByText('common:yes')).toBeInTheDocument()
      const downloadLink = screen.getByLabelText('drawer.cv.download')
      expect(downloadLink).toHaveAttribute('href', 'https://files.example/cv-anna.pdf')
      expect(screen.getByLabelText('drawer.cv.view')).toBeInTheDocument()
    })
  })

  // MOTIVATIE-ZICHTBAAR-1 (Danny 23-07): the careersite motivation letter is
  // honest-gated — no block at all until CMBE emits `coverLetter`.
  describe('Motivation section (MOTIVATIE-ZICHTBAAR-1)', () => {
    it('renders the motivation section when coverLetter is present', () => {
      renderTab(<ApplicationTab application={app({ coverLetter: '<p>Ik solliciteer graag op deze functie.</p>' })} />)
      expect(screen.getByText('motivation.title')).toBeInTheDocument()
      expect(screen.getByText('Ik solliciteer graag op deze functie.')).toBeInTheDocument()
    })

    it('renders nothing when coverLetter is null', () => {
      renderTab(<ApplicationTab application={app({ coverLetter: null })} />)
      expect(screen.queryByText('motivation.title')).toBeNull()
    })

    it('renders nothing when coverLetter is an empty string', () => {
      renderTab(<ApplicationTab application={app({ coverLetter: '' })} />)
      expect(screen.queryByText('motivation.title')).toBeNull()
    })
  })

  // INTERVIEW-CONSENT-PERSIST-1 (Danny 23-07): the consent-tick evidence row is
  // honest-gated — no row at all until CMBE puts a real timestamp on the field.
  describe('Interview consent row (INTERVIEW-CONSENT-PERSIST-1)', () => {
    it('renders the consent row with the formatted date when interviewConsentGivenAt is present', () => {
      renderTab(<ApplicationTab application={app({ interviewConsentGivenAt: '2026-07-20T10:00:00Z' })} />)
      // The mocked useDateFormat.formatDateTime echoes the raw value (see mock above).
      expect(screen.getByText('interviewConsent.given')).toBeInTheDocument()
    })

    it('renders nothing when interviewConsentGivenAt is null', () => {
      renderTab(<ApplicationTab application={app({ interviewConsentGivenAt: null })} />)
      expect(screen.queryByText('interviewConsent.given')).toBeNull()
    })
  })
})
