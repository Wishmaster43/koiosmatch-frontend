/**
 * FlowsTab — I-001: a coded 422 (ai_disclosure_missing) on the flow save reaches the
 * user as the translated common error, never the raw server sentence; the request
 * (method/route/body) is asserted at the seam (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FlowsTab } from './FlowsTab'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
// Key-echo i18n stub.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), initReactI18next: { type: '3rdParty', init: () => {} } }))
// The panel is a stub that hands a fixed payload (active: true) to onSaved.
vi.mock('@/components/ai/management/InterviewFlowsPanel', () => ({
  InterviewFlowsPanel: ({ onSaved }: { onSaved: (p: Record<string, unknown>) => void }) => (
    <button onClick={() => onSaved({ name: 'Intake', active: true })}>save-flow</button>
  ),
}))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

afterEach(() => vi.clearAllMocks())

describe('FlowsTab · coded save refusal', () => {
  it('shows the translated errors.aiDisclosureMissing text, never the raw server sentence', async () => {
    const flow = { id: 'fl-1', name: 'Intake', active: false }
    vi.mocked(api.get).mockImplementation((url: string) => Promise.resolve({ data: { data: url === '/ai/interview-flows' ? [flow] : flow } }))
    vi.mocked(api.put).mockRejectedValue({ response: { status: 422, data: { code: 'ai_disclosure_missing', message: 'NL zin' } } })
    render(<QueryClientProvider client={new QueryClient()}><FlowsTab /></QueryClientProvider>)

    await userEvent.click(await screen.findByText('save-flow'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('errors.aiDisclosureMissing'))
    expect(api.put).toHaveBeenCalledWith('/ai/interview-flows/fl-1', expect.objectContaining({ active: true }))
    expect(notifyError).not.toHaveBeenCalledWith('NL zin')
  })
})
