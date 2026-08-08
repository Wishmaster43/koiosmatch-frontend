/**
 * TemplateComposer (WA-WINDOW-1, Danny punt 12) — outside Meta's 24h window the
 * screen must answer "so how do I send something?". These tests prove the answer
 * is real, not decorative: an approved-template picker that actually POSTs
 * /conversations/start, and an honest block wherever the send could not go
 * through (no candidate, no configuration, unfillable template variables).
 *
 * §13: the mutation assertions check the REQUEST (route + body), never only that
 * a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TemplateComposer from './TemplateComposer'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'

vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

// Measured live 08-08 on tenant yesway: only `hello_world` carries zero {{n}} slots;
// every other approved template needs variables the start endpoint cannot carry.
const NO_VARS = { value: 'hello_world', label: 'hello_world (en_US)', language: 'en_US', components: [{ type: 'BODY', text: 'Hello World' }] }
const WITH_VARS = { value: 'welkom', label: 'welkom (nl)', language: 'nl', components: [{ type: 'BODY', text: 'Welkom {{1}}!' }] }
const NUMBER = { value: 'PN-1', label: 'Yessy - Yesway Flex (+31634478912)' }

const mockLookups = (templates: unknown[] = [NO_VARS, WITH_VARS], numbers: unknown[] = [NUMBER]) => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/whatsapp-templates') return Promise.resolve({ data: { data: templates } })
    if (url === '/whatsapp-phone-numbers') return Promise.resolve({ data: { data: numbers } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(notifyError).mockReset()
  vi.mocked(notifySuccess).mockReset()
  mockLookups()
})

// The combobox trigger is named by its visible field label PLUS its own text
// (CreatableSelect's aria-labelledby pair), so the name is matched as a substring.
const templateTrigger = () => screen.findByRole('button', { name: /conversations\.templatePlaceholder/ })

// Pick a template through the searchable combobox (the only offered path).
const pickTemplate = async (user: ReturnType<typeof userEvent.setup>, label: RegExp) => {
  await user.click(await templateTrigger())
  await user.click(await screen.findByRole('button', { name: label }))
}

describe('TemplateComposer · the closed-window answer', () => {
  it('explains why free text is not the way and offers the approved templates', async () => {
    const { container } = render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)
    expect(await screen.findByText('conversations.sessionClosedHint')).toBeInTheDocument()
    // The picker is the shared searchable combobox — a native <select> is a finding (§4).
    expect(await templateTrigger()).toBeInTheDocument()
    expect(container.querySelector('select')).toBeNull()
  })

  it('says the window state is UNKNOWN rather than claiming it is closed', async () => {
    render(<TemplateComposer candidateId="cand-1" windowKnown={false} onSent={vi.fn()} />)
    expect(await screen.findByText('conversations.windowUnknown')).toBeInTheDocument()
    expect(screen.queryByText('conversations.sessionClosedHint')).not.toBeInTheDocument()
  })

  it('previews the picked template exactly as the candidate receives it', async () => {
    const user = userEvent.setup()
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)
    await pickTemplate(user, /hello_world/)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})

describe('TemplateComposer · POST /conversations/start', () => {
  it('sends candidate_id + phone_number_id + template_name + language and reloads the thread', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const onSent = vi.fn()
    const user = userEvent.setup()
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={onSent} />)

    await pickTemplate(user, /hello_world/)
    await user.click(screen.getByRole('button', { name: /conversations\.sendTemplate/ }))

    expect(api.post).toHaveBeenCalledWith('/conversations/start', {
      candidate_id: 'cand-1', phone_number_id: 'PN-1', template_name: 'hello_world', language: 'en_US',
    })
    expect(notifySuccess).toHaveBeenCalledWith('conversations.templateSent')
    expect(onSent).toHaveBeenCalledTimes(1)
  })

  it('409: shows the sender\'s own reason inline and never toasts', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409, data: { message: 'Kandidaat heeft zich afgemeld.' } } })
    const user = userEvent.setup()
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)

    await pickTemplate(user, /hello_world/)
    await user.click(screen.getByRole('button', { name: /conversations\.sendTemplate/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kandidaat heeft zich afgemeld.')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('502: shows our own honest gateway copy, not the raw server body', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 502, data: { message: 'raw upstream' } } })
    const user = userEvent.setup()
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)

    await pickTemplate(user, /hello_world/)
    await user.click(screen.getByRole('button', { name: /conversations\.sendTemplate/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('conversations.composerUnavailable')
    expect(notifyError).not.toHaveBeenCalled()
  })
})

describe('TemplateComposer · honest gates (no button that silently fails)', () => {
  it('blocks a template with {{n}} variables and says why — the endpoint carries none', async () => {
    const user = userEvent.setup()
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)
    await pickTemplate(user, /welkom/)
    expect(screen.getByText('conversations.templateVarsUnsupported')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conversations\.sendTemplate/ })).toBeDisabled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a thread without a candidate gets a notice, not a dead picker', async () => {
    render(<TemplateComposer candidateId={null} windowKnown onSent={vi.fn()} />)
    expect(await screen.findByText('conversations.templateNeedsCandidate')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conversations\.templatePlaceholder/ })).toBeNull()
  })

  it('zero approved templates is a configuration state with the fix one click away', async () => {
    mockLookups([], [NUMBER])
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)
    expect(await screen.findByText('conversations.templatesEmpty')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'conversations.configureWhatsapp' })).toHaveAttribute('href', '#settings/whatsapp/whatsapp')
  })

  it('no sender number configured: honest notice and Send stays disabled', async () => {
    mockLookups([NO_VARS], [])
    const user = userEvent.setup()
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)
    await pickTemplate(user, /hello_world/)
    expect(screen.getByText('conversations.numbersEmpty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conversations\.sendTemplate/ })).toBeDisabled()
  })

  it('asks WHICH sender number only when the tenant actually has a choice', async () => {
    mockLookups([NO_VARS], [NUMBER, { value: 'PN-2', label: 'Kelly | Yesway (+31628890488)' }])
    render(<TemplateComposer candidateId="cand-1" windowKnown onSent={vi.fn()} />)
    expect(await screen.findByText('conversations.pickNumber')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conversations\.sendTemplate/ })).toBeDisabled()
  })
})
