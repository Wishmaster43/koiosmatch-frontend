/**
 * ApplicationTab · PDF-SOLLICITATIES point 9 (Danny 14-08: "Alle subtabjes
 * onder Sollicitatie worden één tabblad") regression guard: the tab is now ONE
 * flat scroll — every section that used to live behind a Status/Details/CV/
 * Context sub-tab strip (APP-TAB-SPLIT-1, now reversed) renders together, with
 * no click required to reach any of it.
 */
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

// CompetitionBlock (added 25-07) resolves funnel labels/colours through the tenant
// lookup — stub the context so this file keeps testing ApplicationTab's own wiring
// instead of needing the whole provider tree.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [], funnelMeta: (v?: string) => ({ value: v, label: v ?? '', color: 'var(--text-muted)' }) }),
}))

// The vacancy-link edit mode (useVacancyLinkOptions) fetches /vacancies; S31's CvBlock fetches the linked
// candidate's documents via React Query — stub the client so this file only
// tests ApplicationTab's own wiring, not any dependency's internals.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [] })) },
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
  // S-SOURCE-1: ApplicationDetailsCard now reads useApplicationSources (useCachedLookup).
  unwrap: (res: { data?: { data?: unknown } }) => res?.data?.data ?? res?.data,
  getActiveTenantId: () => 'tenant-1',
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

describe('ApplicationTab · one flat scroll (PDF-SOLLICITATIES point 9)', () => {
  it('renders no sub-tab strip and every section at once', () => {
    renderTab(<ApplicationTab application={app()} />)
    expect(screen.queryByRole('tablist')).toBeNull()
    // Details' Bron/Klant/Vacature card is visible without clicking anything.
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })
})

// DD-FE-9 (08-08 drill-down audit): the match-score criteria breakdown
// (per-criterion sliders) sits directly under the score cell.
describe('ApplicationTab · match-score breakdown placement (DD-FE-9, 08-08 drill-down audit)', () => {
  const scored = { score: 75, matchCriteria: [{ key: 'c1', label: 'Skills', score: 80, weight: 1 }] }

  it('renders the match-score breakdown', () => {
    renderTab(<ApplicationTab application={app(scored)} />)
    expect(screen.getByText('matchScore.title')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
  })

  it('saves the adjusted score via onAdjustScore, same payload shape as before the merge', async () => {
    const onAdjustScore = vi.fn()
    const user = userEvent.setup()
    renderTab(<ApplicationTab application={app({ id: 3, ...scored })} onAdjustScore={onAdjustScore} />)
    await user.click(screen.getByTitle('matchScore.edit'))
    await user.click(screen.getByTitle('matchScore.save'))
    // Same PATCH-shaped payload MatchScoreBlock always emitted — only WHERE
    // it renders changed, not the request it produces.
    expect(onAdjustScore).toHaveBeenCalledWith(3, { score: 80, criteria: [{ key: 'c1', label: 'Skills', score: 80, weight: 1 }] })
  })
})

describe('ApplicationTab', () => {
  it('renders the read-only details (source/client/vacancy), no repeated heading', () => {
    renderTab(<ApplicationTab application={app()} />)
    // S3: the redundant "Details" heading is gone — only the pencil marks the block.
    expect(screen.queryByText('drawer.details')).toBeNull()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })

  // Danny 25-07: the reject FORM moved out of this tab into a footer button +
  // confirm modal (RejectionModal); this tab now only renders the read-only
  // outcome (RejectionSummary, covered by its own test file) when rejected.
  it('renders no rejection outcome for an active (not yet rejected) application', () => {
    renderTab(<ApplicationTab application={app()} />)
    expect(screen.queryByText('rejection.rejected')).toBeNull()
  })

  it('renders the read-only rejection outcome once the application is rejected', () => {
    renderTab(<ApplicationTab application={app({ bucket: 'rejected', rejection: { reason_label: 'Niet gekwalificeerd' } })} />)
    expect(screen.getByText('rejection.rejected')).toBeInTheDocument()
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

    it('edits Bron in place (searchable/creatable picker, S-SOURCE-1) and calls onUpdateSource with the new value on save', async () => {
      const onUpdateSource = vi.fn()
      const user = userEvent.setup()
      renderTab(<ApplicationTab application={app({ id: 5 })} onUpdateSource={onUpdateSource} />)
      await user.click(screen.getByLabelText('common:edit'))
      // Bron is now a picker (not a bare input) — open it and type a new value.
      await user.click(screen.getByRole('button', { name: 'Facebook' }))
      await user.type(screen.getByPlaceholderText('drawer.source'), 'LinkedIn')
      await user.click(screen.getByRole('button', { name: 'LinkedIn' }))
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
      await user.click(screen.getByRole('button', { name: 'Facebook' }))
      await user.type(screen.getByPlaceholderText('drawer.source'), 'LinkedIn')
      await user.click(screen.getByRole('button', { name: 'LinkedIn' }))
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
    it('states there is no cv, with no download or preview affordance', async () => {
      renderTab(<ApplicationTab application={app({ candidateId: 'c1' })} />)
      expect(await screen.findByText('drawer.cv.none')).toBeInTheDocument()
      expect(screen.queryByLabelText('drawer.cv.download')).toBeNull()
      expect(screen.queryByLabelText('drawer.cv.view')).toBeNull()
    })

    // Danny 25-07: "Ja" told the recruiter nothing — WHICH cv and from when is the
    // actual information (is this cv recent enough to send to a customer?).
    it('shows the file name + upload date with the download + preview pair when a CV exists', async () => {
      mockGet.mockImplementation((url: string) => String(url).includes('/documents')
        ? Promise.resolve({ data: { data: [{ id: 'd1', name: 'cv-anna.pdf', type: 'CV', url: 'https://files.example/cv-anna.pdf', created_at: '2026-07-01T10:00:00Z' }] } })
        : Promise.resolve({ data: [] }))
      renderTab(<ApplicationTab application={app({ candidateId: 'c1' })} />)
      expect(await screen.findByText('cv-anna.pdf')).toBeInTheDocument()
      expect(screen.getByText('drawer.cv.uploadedOn')).toBeInTheDocument()
      const downloadLink = screen.getByLabelText('drawer.cv.download')
      expect(downloadLink).toHaveAttribute('href', 'https://files.example/cv-anna.pdf')
      expect(screen.getByLabelText('drawer.cv.view')).toBeInTheDocument()
    })
  })

  // MOTIVATIE-ZICHTBAAR-1: the backend ships cover_letter on the detail resource
  // today, but only careersite/partner-API applies ever populate it. These cases lock
  // both halves — the letter renders, and its absence renders nothing at all rather
  // than an empty card — plus the plain-text line-break fallback.
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

    // A partner-API apply can post PLAIN text: without pre-wrap its newlines
    // collapse and the whole letter renders as one unbroken block.
    it('preserves line breaks for a PLAIN-TEXT motivation (white-space: pre-wrap)', () => {
      renderTab(<ApplicationTab application={app({ coverLetter: 'Beste,\n\nGraag solliciteer ik.\nMet groet, Anna' })} />)
      const body = screen.getByText(/Graag solliciteer ik/)
      expect(body).toHaveStyle({ whiteSpace: 'pre-wrap' })
    })

    // The inverse guard: real HTML must NOT get pre-wrap, or the newlines between
    // its <p> tags would render as visible blank lines.
    it('does NOT apply pre-wrap to an HTML motivation', () => {
      renderTab(<ApplicationTab application={app({ coverLetter: '<p>Regel een</p>\n<p>Regel twee</p>' })} />)
      const body = screen.getByText('Regel een').parentElement as HTMLElement
      expect(body).not.toHaveStyle({ whiteSpace: 'pre-wrap' })
    })
  })

  // INTERVIEW-CONSENT-PERSIST-1: the backend ships the timestamp today, but it is
  // null on every application that did not come through the careersite. These two
  // cases lock BOTH halves: positive evidence renders, absence renders nothing —
  // dropping the null-check would print "…given on Invalid Date" on most rows.
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
