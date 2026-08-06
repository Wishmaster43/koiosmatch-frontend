/**
 * CV-PARSER-1 seam test — "kandidaat aanmaken vanuit een CV" through the REAL
 * create modal. Every assertion here is on the REQUEST (method, route, body) or on
 * what the recruiter actually sees; a test that only proved a callback fired would
 * prove nothing about this seam.
 *
 * Guarded contract (measured in routes/api/tenant/candidates.php:56-57):
 *   POST /candidates/parse-cv        multipart field `file` → 202 { status, token }
 *   GET  /candidates/parse-cv/{token} → processing | ready+fields | failed+reason | 404
 *
 * i18next is uninitialised in tests, so t() returns raw keys — assertions query those
 * keys (same pattern as AddCandidateModal.test).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddCandidateModal from '../AddCandidateModal'
import { CV_POLL_INTERVAL_MS, CV_POLL_TIMEOUT_MS } from './useCvParse'

const TOKEN = '6f1d2a54-3c1e-4c6f-9a2b-8e0f5d7c1a33'
const PARSE_URL = '/candidates/parse-cv'
const POLL_URL = `${PARSE_URL}/${TOKEN}`

const { state, createCandidate, getMock, postMock } = vi.hoisted(() => ({
  state: { permissions: ['candidates.create'] as string[] },
  createCandidate: vi.fn<(body: Record<string, unknown>) => Promise<{ id: string }>>(async () => ({ id: 'cand-new' })),
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

// Mock only the axios INSTANCE; keep the real unwrap() so the test exercises the
// same response-shape handling the app uses.
vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: getMock, post: postMock } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/context/LookupsContext', () => ({
  // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant phase lookup colour
  useLookups: () => ({ phases: [{ value: 'lead', label: 'Lead', color: '#94A3B8', is_default: true }] }),
}))
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => ({}) }
})
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'u1', name: 'Piet Recruiter', branch_ids: [] },
  hasPermission: (p: string) => state.permissions.includes(p),
}) }))
vi.mock('../hooks/useCandidateMutations', () => ({ useCreateCandidate: () => ({ createCandidate, saving: false }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [], allowFreeEntry: true }) }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: [] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))

const noop = () => {}

// A minimal, real File — jsdom gives us the same object the browser would hand over.
const pdfFile = (name = 'cv.pdf') => new File(['%PDF-1.4 fake'], name, { type: 'application/pdf' })

// Drive the hidden file input directly (the visible button only forwards a click).
const upload = async (file: File) => {
  const input = screen.getByLabelText('modal.cv.choose') as HTMLInputElement
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
}

// The 202 the controller returns, and the poll answers we script per test.
const accepted = { data: { status: 'processing', token: TOKEN } }

beforeEach(() => {
  state.permissions = ['candidates.create']
  createCandidate.mockReset()
  createCandidate.mockResolvedValue({ id: 'cand-new' })
  getMock.mockReset()
  postMock.mockReset()
  postMock.mockResolvedValue(accepted)
})

describe('CV upload · the request', () => {
  it('POSTs the file as multipart field `file` to /candidates/parse-cv', async () => {
    getMock.mockResolvedValue({ data: { status: 'processing' } })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())

    expect(postMock).toHaveBeenCalledTimes(1)
    const [url, body, config] = postMock.mock.calls[0] as [string, FormData, { signal?: AbortSignal }]
    expect(url).toBe(PARSE_URL)
    expect(body).toBeInstanceOf(FormData)
    const sent = body.get('file') as File
    expect(sent).toBeInstanceOf(File)
    expect(sent.name).toBe('cv.pdf')
    // Abortable, so unmount cannot leave the upload running (§9).
    expect(config?.signal).toBeInstanceOf(AbortSignal)
  })

  it('polls GET /candidates/parse-cv/{token} with the token from the 202', async () => {
    getMock.mockResolvedValue({ data: { status: 'processing' } })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(getMock.mock.calls[0][0]).toBe(POLL_URL)
    expect((getMock.mock.calls[0][1] as { signal?: AbortSignal })?.signal).toBeInstanceOf(AbortSignal)
  })

  it('never uploads a non-PDF — it is refused in the browser', async () => {
    render(<AddCandidateModal onClose={noop} />)
    await upload(new File(['x'], 'cv.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    expect(postMock).not.toHaveBeenCalled()
    expect(await screen.findByText('modal.cv.error.notPdf')).toBeInTheDocument()
  })

  it('hides the whole control without candidates.create (both routes need it)', async () => {
    state.permissions = []
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.queryByText('modal.cv.title')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('modal.cv.choose')).not.toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
  })
})

describe('CV upload · prefill', () => {
  const readyPayload = {
    status: 'ready',
    fields: {
      first_name: 'Anna', last_name: 'de Vries', email: 'anna@example.nl',
      mobile: '0612345678', postcode: '1011 AB', city: 'Amsterdam', date_of_birth: '12-03-1985',
      work_experiences: [{ company: 'Zorggroep A', position: 'Verzorgende IG', location: 'Utrecht', start_date: '2019', end_date: '2022' }],
      educations: [],
    },
  }

  it('fills the form from the ready payload and marks every filled field', async () => {
    getMock.mockResolvedValue({ data: readyPayload })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())

    await waitFor(() => expect((screen.getByPlaceholderText('modal.fields.firstName') as HTMLInputElement).value).toBe('Anna'))
    expect((screen.getByPlaceholderText('modal.fields.lastName') as HTMLInputElement).value).toBe('de Vries')
    expect((screen.getByPlaceholderText('modal.fields.emailPlaceholder') as HTMLInputElement).value).toBe('anna@example.nl')
    expect((screen.getByPlaceholderText('modal.fields.mobilePlaceholder') as HTMLInputElement).value).toBe('0612345678')
    expect((screen.getByPlaceholderText('modal.fields.cityPlaceholder') as HTMLInputElement).value).toBe('Amsterdam')
    // Dutch DD-MM-YYYY normalised to the ISO value a <input type="date"> needs.
    expect((screen.getByLabelText(/modal\.fields\.dob/) as HTMLInputElement).value).toBe('1985-03-12')
    // Seven fields filled ⇒ seven "from CV, check me" badges.
    expect(screen.getAllByText('modal.cv.badge')).toHaveLength(7)
    expect(screen.getByText('modal.cv.checkNotice')).toBeInTheDocument()
  })

  it('drops the mark on a field once the recruiter edits it', async () => {
    getMock.mockResolvedValue({ data: readyPayload })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    await waitFor(() => expect(screen.getAllByText('modal.cv.badge')).toHaveLength(7))

    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'x')
    expect(screen.getAllByText('modal.cv.badge')).toHaveLength(6)
  })

  it('never overwrites a value the recruiter already typed', async () => {
    getMock.mockResolvedValue({ data: readyPayload })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'Annelies')
    await upload(pdfFile())

    await waitFor(() => expect((screen.getByPlaceholderText('modal.fields.lastName') as HTMLInputElement).value).toBe('de Vries'))
    expect((screen.getByPlaceholderText('modal.fields.firstName') as HTMLInputElement).value).toBe('Annelies')
    expect(screen.getByText('modal.cv.skipped')).toBeInTheDocument()
  })

  it('reports work experience it cannot save here instead of pretending to', async () => {
    getMock.mockResolvedValue({ data: readyPayload })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    await waitFor(() => expect(screen.getByText('modal.cv.extraExperiences')).toBeInTheDocument())
    // No education in this payload ⇒ no education line (honest, not a fixed template).
    expect(screen.queryByText('modal.cv.extraEducations')).not.toBeInTheDocument()
  })

  it('creates nothing on its own — the recruiter still has to submit', async () => {
    getMock.mockResolvedValue({ data: readyPayload })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    await waitFor(() => expect((screen.getByPlaceholderText('modal.fields.firstName') as HTMLInputElement).value).toBe('Anna'))
    expect(createCandidate).not.toHaveBeenCalled()
  })

  it('lands free text from a CV NOWHERE — not on screen, not in the create body', async () => {
    // A care CV's health-adjacent prose, plus a field the backend might add later.
    getMock.mockResolvedValue({ data: { status: 'ready', fields: {
      first_name: 'Anna', last_name: 'de Vries',
      summary: 'Na mijn burn-out weer opgebouwd',
      remarks: 'Chronische aandoening, parttime beschikbaar',
      motivation: 'Graag weer aan de slag in de zorg',
    } } })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await upload(pdfFile())
    await waitFor(() => expect((screen.getByPlaceholderText('modal.fields.firstName') as HTMLInputElement).value).toBe('Anna'))

    expect(screen.queryByText(/burn-out/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Chronische/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    const body = JSON.stringify(createCandidate.mock.calls[0][0])
    expect(body).not.toContain('burn-out')
    expect(body).not.toContain('Chronische')
    // PROFILE-TEXT-1: `summary` is now a real field key (the recruiter's OWN typed
    // profile text, addmodal/ProfileTextCard) — assert its VALUE never carries the
    // CV's free text instead of a blanket key-name check, which would now trivially
    // fail on the key itself even though nothing leaked into it.
    expect(createCandidate.mock.calls[0][0].summary).toBeNull()
    expect(body).not.toContain('remarks')
    expect(createCandidate.mock.calls[0][0]).toMatchObject({ first_name: 'Anna', last_name: 'de Vries' })
  })
})

describe('CV upload · failure states are honest', () => {
  it('keeps polling while the job is still processing, then prefills', async () => {
    getMock
      .mockResolvedValueOnce({ data: { status: 'processing' } })
      .mockResolvedValue({ data: { status: 'ready', fields: { first_name: 'Anna' } } })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())

    await waitFor(() => expect(screen.getByText('modal.cv.reading')).toBeInTheDocument())
    await waitFor(
      () => expect((screen.getByPlaceholderText('modal.fields.firstName') as HTMLInputElement).value).toBe('Anna'),
      { timeout: CV_POLL_INTERVAL_MS + 3000 },
    )
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['budget_exceeded', 'modal.cv.error.budget'],
    ['unparseable', 'modal.cv.error.unreadable'],
    ['unavailable', 'modal.cv.error.unavailable'],
    ['expired', 'modal.cv.error.expired'],
    ['not_a_pdf', 'modal.cv.error.notPdf'],
  ])('turns a failed parse (%s) into its own translated message', async (reason, key) => {
    getMock.mockResolvedValue({ data: { status: 'failed', reason } })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    expect(await screen.findByText(key)).toBeInTheDocument()
  })

  it('maps an unknown/expired token (404) to the expired message, never the server sentence', async () => {
    getMock.mockRejectedValue({ response: { status: 404, data: { message: 'Onbekende of verlopen aanvraag.' } } })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    expect(await screen.findByText('modal.cv.error.expired')).toBeInTheDocument()
    expect(screen.queryByText('Onbekende of verlopen aanvraag.')).not.toBeInTheDocument()
  })

  it('maps the 10/min throttle (429) to its own message', async () => {
    postMock.mockRejectedValue({ response: { status: 429 } })
    render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    expect(await screen.findByText('modal.cv.error.throttled')).toBeInTheDocument()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('stops at the ceiling with an honest timeout instead of polling forever', async () => {
    vi.useFakeTimers()
    try {
      getMock.mockResolvedValue({ data: { status: 'processing' } })
      render(<AddCandidateModal onClose={noop} />)
      const input = screen.getByLabelText('modal.cv.choose') as HTMLInputElement
      await act(async () => { fireEvent.change(input, { target: { files: [pdfFile()] } }) })
      // Past the ceiling: the chain must end, not keep firing requests.
      await act(async () => { await vi.advanceTimersByTimeAsync(CV_POLL_TIMEOUT_MS + CV_POLL_INTERVAL_MS * 2) })
      expect(screen.getByText('modal.cv.error.timeout')).toBeInTheDocument()
      const calls = getMock.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(CV_POLL_INTERVAL_MS * 5) })
      expect(getMock.mock.calls.length).toBe(calls)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('CV upload · lifecycle', () => {
  afterEach(() => vi.restoreAllMocks())

  it('aborts the in-flight poll when the modal unmounts', async () => {
    getMock.mockResolvedValue({ data: { status: 'processing' } })
    const { unmount } = render(<AddCandidateModal onClose={noop} />)
    await upload(pdfFile())
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    const signal = (getMock.mock.calls[0][1] as { signal: AbortSignal }).signal
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })
})
