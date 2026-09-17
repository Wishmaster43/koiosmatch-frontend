/**
 * StartConversationModal (WHATSAPP-COMPOSE-1) — the cold-start template send:
 * only fetched/approved templates are offered (never a typed name), a single
 * configured sender number is picked silently, and POST /conversations/start
 * carries exactly candidate_id + phone_number_id + template_name(+language).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StartConversationModal from './StartConversationModal'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'

vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

const TEMPLATE = { value: 'welkom', label: 'welkom (nl)', language: 'nl', category: 'UTILITY', components: [{ type: 'BODY', text: 'Welkom {{1}}!' }] }
const NUMBER = { value: 'PN-1', label: 'Bureau (+31612345678)' }
// GET /ai/agents raw shape ({id,name}) — the component maps this to {value,label} itself.
const AGENT = { id: 'agent-1', name: 'Kelly' }

// WA-SEND-1: the user's own devices (GET /profile/whatsapp-web) and every connected
// device (GET /whatsapp-web-numbers?scope=usable) — none by default, so the template path is the
// preselect and the earlier cases stay byte-identical.
const OWN_DEVICE = { id: 'd-own', type: 'wa_web', label: 'Kelly', phone_number: '+31611111111', status: 'connected' }
const OWN_OPTION = { value: 'd-own', label: 'Kelly (+31611111111)', scope: 'user', owner: 'Kelly Yesway' }
const BRANCH_OPTION = { value: 'd-branch', label: 'Hoofdkantoor (+31622222222)', scope: 'location', owner: 'Hoofdkantoor' }

const mockLookups = (templates: unknown[] = [TEMPLATE], numbers: unknown[] = [NUMBER], agents: unknown[] = [], own: unknown[] = [], webNumbers: unknown[] = []) => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/whatsapp-templates') return Promise.resolve({ data: { data: templates } })
    if (url === '/whatsapp-phone-numbers') return Promise.resolve({ data: { data: numbers } })
    if (url === '/ai/agents') return Promise.resolve({ data: { data: agents } })
    if (url === '/profile/whatsapp-web') return Promise.resolve({ data: { data: own } })
    if (url === '/whatsapp-web-numbers?scope=usable') return Promise.resolve({ data: { data: webNumbers } })
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

const noop = () => {}

describe('StartConversationModal · template picker (approved templates only)', () => {
  it('only offers the fetched templates, never a typed name (allowCreate=false)', async () => {
    const user = userEvent.setup()
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    expect(await screen.findByRole('button', { name: /welkom \(nl\)/ })).toBeInTheDocument()
    // No free-text "create" option ever appears for an unmatched query.
    await user.type(screen.getByPlaceholderText('conversations.templatePlaceholder'), 'made-up-template')
    expect(screen.queryByText(/made-up-template/)).not.toBeInTheDocument()
  })

  it('shows an honest empty state when the tenant has no approved templates', async () => {
    mockLookups([], [NUMBER])
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    expect(await screen.findByText('conversations.templatesEmpty')).toBeInTheDocument()
  })

  it('renders a read-only preview of the picked template\'s body', async () => {
    const user = userEvent.setup()
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    // Unfilled {{n}} slots show as-is — ConversationStartController never substitutes them.
    expect(screen.getByText('Welkom {{1}}!')).toBeInTheDocument()
  })
})

describe('StartConversationModal · sender number (phone_number_id)', () => {
  it('picks a single configured number silently — no picker shown', async () => {
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    await screen.findByRole('button', { name: 'conversations.templatePlaceholder' })
    expect(screen.queryByText('conversations.pickNumber')).not.toBeInTheDocument()
  })

  it('shows a picker when several sender numbers are configured', async () => {
    mockLookups([TEMPLATE], [NUMBER, { value: 'PN-2', label: 'Tweede (+31698765432)' }])
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    expect(await screen.findByText('conversations.pickNumber')).toBeInTheDocument()
  })

  it('disables Send with an honest reason when no sender number is configured at all', async () => {
    mockLookups([TEMPLATE], [])
    const user = userEvent.setup()
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    expect(screen.getByText('conversations.numbersEmpty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'conversations.start' })).toBeDisabled()
  })
})

describe('StartConversationModal · POST /conversations/start', () => {
  it('sends candidate_id + phone_number_id + template_name + language, and refreshes on success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const onStarted = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<StartConversationModal candidateId="cand-1" onClose={onClose} onStarted={onStarted} />)

    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(api.post).toHaveBeenCalledWith('/conversations/start', {
      candidate_id: 'cand-1', phone_number_id: 'PN-1', template_name: 'welkom', language: 'nl',
    })
    expect(notifySuccess).toHaveBeenCalledWith('conversations.started')
    expect(onStarted).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('surfaces the server\'s own pointable message on failure (never a generic string)', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Deze template is niet gesynchroniseerd of niet goedgekeurd voor dit nummer.' } } })
    const onStarted = vi.fn()
    const user = userEvent.setup()
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={onStarted} />)

    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(await screen.findByRole('button', { name: 'conversations.start' })).not.toBeDisabled()
    expect(notifyError).toHaveBeenCalledWith('Deze template is niet gesynchroniseerd of niet goedgekeurd voor dit nummer.')
    expect(onStarted).not.toHaveBeenCalled()
  })
})

// CONTACT-CONVERSATION-START: the same modal starts a thread with a customer
// contact — the POST pins customer_contact_id and NEVER candidate_id (strict XOR,
// postConversationsStart in api-generated.ts).
describe('StartConversationModal · customer-contact subject (CONTACT-CONVERSATION-START)', () => {
  it('sends customer_contact_id, never candidate_id, for a customer_contact subject', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const onStarted = vi.fn()
    const user = userEvent.setup()
    render(<StartConversationModal subject={{ kind: 'customer_contact', id: 'contact-1' }} onClose={noop} onStarted={onStarted} />)

    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(api.post).toHaveBeenCalledWith('/conversations/start', {
      customer_contact_id: 'contact-1', phone_number_id: 'PN-1', template_name: 'welkom', language: 'nl',
    })
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('candidate_id')
    expect(onStarted).toHaveBeenCalledTimes(1)
  })

  it('surfaces a 409 (no whatsapp_consent) and a 422 (no mobile) via notifyError, never a generic string', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409, data: { message: 'Deze contactpersoon heeft geen WhatsApp-toestemming.' } } })
    const user = userEvent.setup()
    render(<StartConversationModal subject={{ kind: 'customer_contact', id: 'contact-1' }} onClose={noop} onStarted={noop} />)

    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(notifyError).toHaveBeenCalledWith('Deze contactpersoon heeft geen WhatsApp-toestemming.')
  })
})

// CONV-START-AGENT-1: the optional AI-agent picker — never required to send, its
// choice rides along as `agent_id` only when actually picked, and an unknown/foreign
// id (Laravel's exists:ai_agents,id) surfaces as a FIELD error next to the picker,
// never the generic toast.
describe('StartConversationModal · AI-agent picker (CONV-START-AGENT-1)', () => {
  const pickTemplateAndOpenAgentPicker = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
  }

  it('omits agent_id from the POST body when no agent is chosen, even when agents exist', async () => {
    mockLookups([TEMPLATE], [NUMBER], [AGENT])
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const user = userEvent.setup()
    await pickTemplateAndOpenAgentPicker(user)
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(api.post).toHaveBeenCalledWith('/conversations/start', {
      candidate_id: 'cand-1', phone_number_id: 'PN-1', template_name: 'welkom', language: 'nl',
    })
  })

  it('sends agent_id when an AI agent is picked', async () => {
    mockLookups([TEMPLATE], [NUMBER], [AGENT])
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const user = userEvent.setup()
    await pickTemplateAndOpenAgentPicker(user)
    await user.click(await screen.findByRole('button', { name: 'conversations.agentPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Kelly' }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(api.post).toHaveBeenCalledWith('/conversations/start', {
      candidate_id: 'cand-1', phone_number_id: 'PN-1', template_name: 'welkom', language: 'nl', agent_id: 'agent-1',
    })
  })

  it('maps a 422 on agent_id to a field error next to the picker, never the generic toast', async () => {
    mockLookups([TEMPLATE], [NUMBER], [AGENT])
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { status: 422, data: { message: 'The given data was invalid.', errors: { agent_id: ['Het gekozen ai-agent id is ongeldig.'] } } },
    })
    const user = userEvent.setup()
    await pickTemplateAndOpenAgentPicker(user)
    await user.click(await screen.findByRole('button', { name: 'conversations.agentPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Kelly' }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Het gekozen ai-agent id is ongeldig.')
    expect(notifyError).not.toHaveBeenCalled()
  })
})

// WA-SEND-1 (Danny 10-09): the channel pill row, the WhatsApp Web free-text path over the
// own device, the branch-device fallback, and the honest no-device state.
describe('StartConversationModal · WhatsApp Web channel (WA-SEND-1)', () => {
  it('preselects WhatsApp Web on the own connected device and posts channel + message + device; 202 reads as scheduled', async () => {
    mockLookups([TEMPLATE], [NUMBER], [], [OWN_DEVICE], [OWN_OPTION, BRANCH_OPTION])
    vi.mocked(api.post).mockResolvedValue({ status: 202, data: { outbox_id: 'ob-1', status: 'queued' } })
    const onStarted = vi.fn(); const onClose = vi.fn()
    render(<StartConversationModal candidateId={7} onClose={onClose} onStarted={onStarted} />)
    // The WA Web pill is active, the free-text field is there, the template picker is not.
    await waitFor(() => expect(screen.getByRole('button', { name: 'conversations.channelWaWeb' })).toHaveAttribute('aria-pressed', 'true'))
    const field = await screen.findByPlaceholderText('conversations.messagePlaceholder')
    expect(screen.queryByText('conversations.pickTemplate')).toBeNull()
    fireEvent.change(field, { target: { value: 'Hoi Niels, kun je morgen?' } })
    // Own + branch device → the picker shows with the own device picked silently.
    expect(screen.getByText('conversations.pickDevice')).toBeInTheDocument()
    // The manual picker asks for the `usable` set (DANNY-AVOND-BE-1 round 3), never the builder's full roster.
    expect(api.get).toHaveBeenCalledWith('/whatsapp-web-numbers?scope=usable')
    fireEvent.click(screen.getByRole('button', { name: 'conversations.send' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/conversations/start', { candidate_id: 7, channel: 'wa_web', message: 'Hoi Niels, kun je morgen?', whatsapp_number_id: 'd-own' }))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('conversations.queued'))
    expect(onStarted).toHaveBeenCalled(); expect(onClose).toHaveBeenCalled()
  })

  it('with branch devices only, WhatsApp Web needs a picked device before Send enables', async () => {
    mockLookups([TEMPLATE], [NUMBER], [], [], [BRANCH_OPTION])
    render(<StartConversationModal subject={{ kind: 'customer_contact', id: 'ct-1' }} onClose={() => {}} onStarted={() => {}} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'conversations.channelWaWeb' })).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.change(await screen.findByPlaceholderText('conversations.messagePlaceholder'), { target: { value: 'Goedemiddag' } })
    expect(screen.getByRole('button', { name: 'conversations.send' })).toBeDisabled()
  })

  it('without any linked device the template path stays preselected and WhatsApp Web says so with a link', async () => {
    mockLookups()
    render(<StartConversationModal candidateId={7} onClose={() => {}} onStarted={() => {}} />)
    expect(await screen.findByText('conversations.pickTemplate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'conversations.channelWaba' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'conversations.channelWaWeb' }))
    expect(await screen.findByText('conversations.devicesEmpty')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'conversations.linkDevice' })).toHaveAttribute('href', '#profile')
    expect(screen.getByRole('button', { name: 'conversations.send' })).toBeDisabled()
  })

  it('surfaces the server\'s 409 (no consent) reason on a WhatsApp Web send, never a generic string', async () => {
    mockLookups([TEMPLATE], [NUMBER], [], [OWN_DEVICE], [OWN_OPTION])
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: 'Geen WhatsApp-toestemming voor deze kandidaat.' } } })
    render(<StartConversationModal candidateId={7} onClose={() => {}} onStarted={() => {}} />)
    fireEvent.change(await screen.findByPlaceholderText('conversations.messagePlaceholder'), { target: { value: 'Hoi' } })
    fireEvent.click(screen.getByRole('button', { name: 'conversations.send' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Geen WhatsApp-toestemming voor deze kandidaat.'))
  })
})

// D8: a failed templates/numbers GET must render as a retryable error, never
// collapse into the "0 rows configured" ConfigNotice — that told the recruiter
// to go configure something that was already configured.
describe('StartConversationModal · failed lookup load (four UI states)', () => {
  it('shows an error banner with retry instead of the configuration notices', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/agents') return Promise.resolve({ data: { data: [] } })
      if (url === '/profile/whatsapp-web') return Promise.resolve({ data: { data: [] } })
      if (url === '/whatsapp-web-numbers?scope=usable') return Promise.resolve({ data: { data: [] } })
      return Promise.reject(new Error('network error'))
    })
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    expect(await screen.findByText('conversations.loadError')).toBeInTheDocument()
    expect(screen.queryByText('conversations.templatesEmpty')).not.toBeInTheDocument()
    expect(screen.queryByText('conversations.numbersEmpty')).not.toBeInTheDocument()
  })

  it('retries the load on demand', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/agents') return Promise.resolve({ data: { data: [] } })
      if (url === '/profile/whatsapp-web') return Promise.resolve({ data: { data: [] } })
      if (url === '/whatsapp-web-numbers?scope=usable') return Promise.resolve({ data: { data: [] } })
      return Promise.reject(new Error('network error'))
    })
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    await screen.findByText('conversations.loadError')

    mockLookups()
    await user.click(screen.getByRole('button', { name: 'error.retry' }))
    expect(await screen.findByText('conversations.pickTemplate')).toBeInTheDocument()
  })

  it('never hides the working wa_web textarea/device-picker behind the templates/numbers error banner — that GET is waba-only', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/profile/whatsapp-web') return Promise.resolve({ data: { data: [OWN_DEVICE] } })
      if (url === '/whatsapp-web-numbers?scope=usable') return Promise.resolve({ data: { data: [OWN_OPTION] } })
      // Templates/numbers/agents all fail — wa_web needs none of them.
      return Promise.reject(new Error('network error'))
    })
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)
    // Own device present → channel preselects to wa_web (Danny Q4).
    expect(await screen.findByPlaceholderText('conversations.messagePlaceholder')).toBeInTheDocument()
    expect(screen.queryByText('conversations.loadError')).not.toBeInTheDocument()
  })
})

// GESPREK-CONSISTENT-1: application_id travels on both the waba and wa_web POST
// bodies for a candidate subject only, never for a customer_contact subject
// (KLEIN-BE-2, api b046655f: 422 on a contact owner, stamp only on a thread without one).
describe('StartConversationModal · applicationId (GESPREK-CONSISTENT-1-FE)', () => {
  it('includes application_id on the waba template POST when given', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const user = userEvent.setup()
    render(<StartConversationModal candidateId="cand-1" applicationId="app-1" onClose={noop} onStarted={noop} />)

    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    expect(api.post).toHaveBeenCalledWith('/conversations/start', {
      candidate_id: 'cand-1', application_id: 'app-1', phone_number_id: 'PN-1', template_name: 'welkom', language: 'nl',
    })
  })

  it('omits application_id on the waba template POST when not given', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const user = userEvent.setup()
    render(<StartConversationModal candidateId="cand-1" onClose={noop} onStarted={noop} />)

    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('application_id')
  })

  it('includes application_id on the wa_web POST when given', async () => {
    mockLookups([TEMPLATE], [NUMBER], [], [OWN_DEVICE], [OWN_OPTION])
    vi.mocked(api.post).mockResolvedValue({ status: 202, data: { outbox_id: 'ob-1', status: 'queued' } })
    render(<StartConversationModal candidateId={7} applicationId="app-1" onClose={noop} onStarted={noop} />)
    const field = await screen.findByPlaceholderText('conversations.messagePlaceholder')
    fireEvent.change(field, { target: { value: 'Hoi Niels, kun je morgen?' } })
    fireEvent.click(screen.getByRole('button', { name: 'conversations.send' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/conversations/start', {
      candidate_id: 7, application_id: 'app-1', channel: 'wa_web', message: 'Hoi Niels, kun je morgen?', whatsapp_number_id: 'd-own',
    }))
  })

  it('never sends application_id for a customer_contact subject, even when given', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { conversation_id: 'conv-1', status: 'sent' } })
    const user = userEvent.setup()
    render(<StartConversationModal subject={{ kind: 'customer_contact', id: 'contact-1' }} applicationId="app-1" onClose={noop} onStarted={noop} />)

    await user.click(await screen.findByRole('button', { name: 'conversations.templatePlaceholder' }))
    await user.click(await screen.findByRole('button', { name: /welkom \(nl\)/ }))
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('application_id')
    expect(body).toHaveProperty('customer_contact_id', 'contact-1')
  })
})
