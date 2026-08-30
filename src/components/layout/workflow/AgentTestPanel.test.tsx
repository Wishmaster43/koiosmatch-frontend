/**
 * AgentTestPanel.test — verdict finding 1 (BLOCKING): asserts the actual POST
 * body sent to the PAID /ai/agents/test endpoint (§13: the request, not just
 * that a callback fired), so the sanitized-config wiring in AgentTestPanel
 * itself is covered, not only the buildTestConfig unit. No real i18n is
 * initialized here (mirrors configPanelInstructionList.test.tsx), so `t()`
 * returns the raw key.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AgentTestPanel from './AgentTestPanel'

// jsdom has no scrollIntoView implementation; the component calls it on every
// new message via a ref effect, unrelated to what this test asserts.
Element.prototype.scrollIntoView = vi.fn()

const postMock = vi.fn().mockResolvedValue({ data: { response: 'ok' } })
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => postMock(...args) },
  unwrap: (res: { data: unknown }) => res.data,
}))

beforeEach(() => postMock.mockClear())

// Types the message, presses send, and waits for the mocked POST to land.
async function send() {
  fireEvent.change(screen.getByPlaceholderText('agentTest.inputPlaceholder'), { target: { value: 'hi' } })
  fireEvent.click(screen.getByLabelText('agentTest.send'))
  await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
  // Wait for the mocked reply to render too, so no state update escapes act().
  await screen.findByText('ok')
}

describe('AgentTestPanel · POST body', () => {
  it('sends the existing persona verbatim and never forwards the instructions array', async () => {
    render(<AgentTestPanel config={{ instruction: 'persona', instructions: [{ id: 'q1', text: '<p>Vraag 1</p>' }] }} />)
    await send()
    const body = postMock.mock.calls[0][1]
    expect(body.config.instruction).toBe('persona')
    expect('instructions' in body.config).toBe(false)
  })

  it('falls back to a numbered plain-text persona when none is configured yet', async () => {
    render(<AgentTestPanel config={{ instructions: [{ id: 'q1', text: '<p>Vraag 1</p>' }] }} />)
    await send()
    const body = postMock.mock.calls[0][1]
    expect(body.config.instruction).toBe('1. Vraag 1')
    expect('instructions' in body.config).toBe(false)
  })
})
