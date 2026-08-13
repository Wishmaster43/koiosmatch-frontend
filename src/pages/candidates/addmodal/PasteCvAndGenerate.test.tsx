/**
 * PASTE-CV-1 + GENERATE-FIELDS-1 seam tests — paste-CV text through the SAME
 * /candidates/parse-cv poll pipeline as the file upload, and the profile-text
 * "Genereer met Koios" flow against /ai/koios/generate. Every assertion is on
 * the REQUEST (method, route, body) or on what the recruiter sees — mirrors
 * CvUpload.test.tsx's harness so both proposal features exercise the same seam.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddCandidateModal from '../AddCandidateModal'
import { CV_TEXT_MIN_CHARS } from './useCvParse'

const TOKEN = '6f1d2a54-3c1e-4c6f-9a2b-8e0f5d7c1a33'
const PARSE_URL = '/candidates/parse-cv'
const POLL_URL = `${PARSE_URL}/${TOKEN}`
const GENERATE_URL = '/ai/koios/generate'

const { state, createCandidate, getMock, postMock } = vi.hoisted(() => ({
  state: { permissions: ['candidates.create'] as string[] },
  createCandidate: vi.fn<(body: Record<string, unknown>) => Promise<{ id: string }>>(async () => ({ id: 'cand-new' })),
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

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
// Swap the rich-text editor for a plain textarea — this test proves the badge
// LIFECYCLE (apply → mark, edit → clear), not the tiptap editing mechanics,
// and prosemirror throws in jsdom (elementFromPoint/getClientRects missing).
vi.mock('@/components/ui/CollapsibleRichText', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="profile.summary" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

const noop = () => {}
const LONG_TEXT = 'Anna de Vries, verzorgende IG met tien jaar ervaring in de ouderenzorg. '.repeat(2)
const SHORT_TEXT = 'te kort'

// CV-ENTRY-ICONS-1: paste now starts from a header icon that opens a popover
// with the same textarea/submit — open it first, mirroring the real recruiter flow.
const openPastePopover = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'modal.cvPaste.openButton' }))
}

const pasteAndSubmit = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await openPastePopover(user)
  const textarea = screen.getByLabelText('modal.cvPaste.title')
  await user.click(textarea)
  await user.paste(text)
  const submitBtn = screen.getByRole('button', { name: 'modal.cvPaste.submit' })
  await user.click(submitBtn)
}

beforeEach(() => {
  state.permissions = ['candidates.create']
  createCandidate.mockReset()
  createCandidate.mockResolvedValue({ id: 'cand-new' })
  getMock.mockReset()
  postMock.mockReset()
  postMock.mockResolvedValue({ data: { status: 'processing', token: TOKEN } })
})

describe('Paste-CV · the request', () => {
  it('POSTs { raw_text } as JSON to /candidates/parse-cv, then polls the token', async () => {
    getMock.mockResolvedValue({ data: { status: 'processing' } })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await pasteAndSubmit(user, LONG_TEXT)

    expect(postMock).toHaveBeenCalledTimes(1)
    const [url, body, config] = postMock.mock.calls[0] as [string, { raw_text: string }, { signal?: AbortSignal }]
    expect(url).toBe(PARSE_URL)
    expect(body).toEqual({ raw_text: LONG_TEXT.trim() })
    expect(config?.signal).toBeInstanceOf(AbortSignal)

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(getMock.mock.calls[0][0]).toBe(POLL_URL)
  })

  it('shows a calm hint and fires no request under the character minimum', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await openPastePopover(user)
    const textarea = screen.getByLabelText('modal.cvPaste.title')
    await user.click(textarea)
    await user.paste(SHORT_TEXT)

    expect(screen.getByText('modal.cvPaste.tooShort')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.cvPaste.submit' })).toBeDisabled()
    expect(postMock).not.toHaveBeenCalled()
    expect(SHORT_TEXT.length).toBeLessThan(CV_TEXT_MIN_CHARS)
  })

  it('prefills the form and marks fields from the ready payload — same mapping as the upload path', async () => {
    getMock.mockResolvedValue({ data: { status: 'ready', fields: { first_name: 'Anna', last_name: 'de Vries' } } })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await pasteAndSubmit(user, LONG_TEXT)

    await waitFor(() => expect((screen.getByPlaceholderText('modal.fields.firstName') as HTMLInputElement).value).toBe('Anna'))
    expect(screen.getAllByText('modal.cv.badge')).toHaveLength(2)
    expect(createCandidate).not.toHaveBeenCalled()
  })

  it('hides the whole control without candidates.create', async () => {
    state.permissions = []
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.queryByText('modal.cvPaste.title')).not.toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
  })
})

describe('Profile-text generate · the request', () => {
  it('POSTs entity+fields to /ai/koios/generate and applies the concept with the Koios badge', async () => {
    postMock.mockResolvedValue({ data: { text: 'Ervaren verzorgende met oog voor detail.' } })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)

    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'generate.button' }))
    await user.click(screen.getByRole('button', { name: 'generate.cta' }))

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    const [url, body] = postMock.mock.calls[0] as [string, { entity: string; fields: Record<string, string> }]
    expect(url).toBe(GENERATE_URL)
    expect(body).toEqual({ entity: 'candidate', fields: { first_name: 'Anna' } })

    await user.click(await screen.findByRole('button', { name: 'generate.apply' }))
    expect(screen.getByText('Ervaren verzorgende met oog voor detail.')).toBeInTheDocument()
    expect(screen.getByTestId('koios-suggestion')).toBeInTheDocument()
  })

  it('clears the badge once the recruiter edits the applied text', async () => {
    postMock.mockResolvedValue({ data: { text: 'Concepttekst.' } })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'generate.button' }))
    await user.click(screen.getByRole('button', { name: 'generate.cta' }))
    await user.click(await screen.findByRole('button', { name: 'generate.apply' }))
    expect(screen.getByTestId('koios-suggestion')).toBeInTheDocument()

    // Editing the applied text drops the mark — the recruiter checked it.
    await user.type(screen.getByLabelText('profile.summary'), 'x')
    expect(screen.queryByTestId('koios-suggestion')).not.toBeInTheDocument()
  })

  it('treats 402 (credit exhausted) and 503 (unavailable) as real, translated errors — not a silent null', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 402 } })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.fields.firstName'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'generate.button' }))
    await user.click(screen.getByRole('button', { name: 'generate.cta' }))
    expect(await screen.findByText('common:errors.koiosCreditExhausted')).toBeInTheDocument()

    postMock.mockRejectedValueOnce({ response: { status: 503 } })
    await user.click(screen.getByRole('button', { name: 'common:error.retry' }))
    expect(await screen.findByText('common:errors.koiosUnavailable')).toBeInTheDocument()
  })

  it('disables the entry button until a name or function title is filled', async () => {
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByRole('button', { name: 'generate.button' })).toBeDisabled()
    expect(postMock).not.toHaveBeenCalled()
  })
})
