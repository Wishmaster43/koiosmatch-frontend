/**
 * WebhookSelectField — ONIX N-007 regression: the inline "create a webhook"
 * form's Enter handler used to call `create()` with no in-flight guard, so
 * two synchronous Enter presses could POST /webhooks twice. Proves one POST.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WebhookSelectField } from './WebhookSelectField'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrap: (r: { data?: unknown }) => r?.data,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

beforeEach(async () => {
  const api = (await import('@/lib/api')).default
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: { data: [] } })
  vi.mocked(api.post).mockReset()
})

describe('WebhookSelectField', () => {
  it('two synchronous Enter presses in the inline create field POST /webhooks once', async () => {
    const api = (await import('@/lib/api')).default
    // Never resolves within this test — proves the second Enter is dropped
    // while the first create() is still in flight, not merely fast.
    vi.mocked(api.post).mockReturnValueOnce(new Promise(() => {}))
    render(<WebhookSelectField value={undefined} onChange={vi.fn()} fieldKey="webhook_id" />)

    await waitFor(() => expect(screen.queryByText('fields.webhookLoading')).not.toBeInTheDocument())
    fireEvent.click(screen.getByText('fields.webhookCreate'))
    const input = screen.getByPlaceholderText('fields.webhookNamePlaceholder')
    fireEvent.change(input, { target: { value: 'Intus' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })

    // §13: the request itself, not only that a callback fired. `create` awaits a
    // dynamic `import('@/lib/api')` before posting, so the POST lands a tick later.
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post).toHaveBeenCalledWith('/webhooks', { name: 'Intus' })
  })
})
