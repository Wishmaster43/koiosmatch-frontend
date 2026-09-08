/**
 * ConfigPanel.requestsTab.test — WEBHOOK-LOG-FE-2: the Webhook Trigger step's
 * config panel gets a "Verzoeken" tab that shows the same per-webhook request
 * log Settings shows. No i18n instance is initialized here (mirrors
 * ConfigPanel.translationsTab.test.tsx) so `t()` returns the raw key.
 * The request log itself (WebhookRequestsLog) is mocked to a stub — this file
 * verifies routing/gating, not the log's own rendering (covered by
 * WebhookRequestsPanel.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

// Pin i18n.language only (mirrors the translations-tab test); t() stays the raw key.
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return { ...actual, useTranslation: () => ({
    t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k,
    i18n: { language: 'nl' }
  }) }
})

// The webhook-id → name lookup fetch (ConfigPanel's own /webhooks call).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn().mockResolvedValue({ data: { data: [{ id: 'wh-1', name: 'My Webhook' }] } }) },
  }
})

// Stub the log body: proves ConfigPanel wires webhookId/webhookName through,
// without re-testing the table itself (WebhookRequestsPanel.test.tsx owns that).
vi.mock('@/components/webhooks/WebhookRequestsPanel', () => ({
  WebhookRequestsLog: ({ webhookId, webhookName }: { webhookId: string | number; webhookName: string }) => (
    <div data-testid="webhook-requests-log">log:{String(webhookId)}:{webhookName}</div>
  ),
}))

describe('ConfigPanel · webhook Verzoeken tab', () => {
  it('shows the Verzoeken tab for a webhook node and renders the log once a webhook is picked', async () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'webhook', config: { webhook_id: 'wh-1' } } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('config.tabRequests')).toBeInTheDocument()
    fireEvent.click(screen.getByText('config.tabRequests'))
    await waitFor(() => expect(screen.getByTestId('webhook-requests-log')).toHaveTextContent('log:wh-1:My Webhook'))
  })

  it('shows a pick-first notice instead of the log when no webhook is picked yet', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'webhook', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabRequests'))
    expect(screen.getByText('config.requestsPickWebhook')).toBeInTheDocument()
    expect(screen.queryByTestId('webhook-requests-log')).not.toBeInTheDocument()
  })

  it('does not show the Verzoeken tab for a non-webhook node', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'customers', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('config.tabRequests')).not.toBeInTheDocument()
  })
})
