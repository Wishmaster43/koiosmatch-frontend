/**
 * StartConversationModal (WHATSAPP-COMPOSE-1) — the cold-start template send:
 * only fetched/approved templates are offered (never a typed name), a single
 * configured sender number is picked silently, and POST /conversations/start
 * carries exactly candidate_id + phone_number_id + template_name(+language).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

const mockLookups = (templates: unknown[] = [TEMPLATE], numbers: unknown[] = [NUMBER]) => {
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
