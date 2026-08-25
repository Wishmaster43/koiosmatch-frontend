/**
 * QueueTab · priority translation (K-194 e) — `GET /whatsapp-queue` now sends a
 * priority SLUG (high|normal|low), never a Dutch label; the tab must render the
 * translated word, never the raw slug.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import QueueTab from './QueueTab'
import type { WaQueueBatch } from '@/types/whatsapp'

const batch = (over: Partial<WaQueueBatch>): WaQueueBatch =>
  ({ batch_id: 'b1', workflow_name: 'Follow-up', total: 10, sent: 5, skipped: 0, failed: 0,
    priority: 'high', status: 'running', ...over } as WaQueueBatch)

describe('QueueTab · priority slug translation', () => {
  it('renders the translated priority word, never the raw slug', () => {
    render(<QueueTab batches={[batch({ priority: 'high' })]} loading={false} error={false} notAvailable={false} />)
    // Default test locale is 'nl' (src/i18n) — 'high' translates to 'Hoog'.
    expect(screen.getByText(/Hoog/)).toBeInTheDocument()
    expect(screen.queryByText('high')).not.toBeInTheDocument()
  })

  it('falls back to a humanized word for an unknown value, never the raw slug', () => {
    render(<QueueTab batches={[batch({ priority: 'urgent_now' })]} loading={false} error={false} notAvailable={false} />)
    expect(screen.getByText(/Urgent now/)).toBeInTheDocument()
    expect(screen.queryByText('urgent_now')).not.toBeInTheDocument()
  })
})
