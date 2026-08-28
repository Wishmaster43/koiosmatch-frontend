/**
 * configPanelInterviewFlow.test — the render-seam pin the module-object test
 * could not give (verify r2): the interview_start node really SHOWS its flow
 * picker, the picker really fetches /ai/interview-flows, and picking back the
 * "default" option really writes '' through onUpdate (engine fallback chain).
 * Real i18n is not initialized (mirrors configPanelRequired.test) — t() keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'
import api from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const node: FlowNode = {
  id: 'n1', position: { x: 0, y: 0 },
  data: { type: 'interview_start', config: { interview_flow_id: 'f2' } },
}

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: [
    { id: 'f1', name: 'Zorgintake', channel: 'whatsapp', active: true },
    { id: 'f2', name: 'Logistiek', channel: 'whatsapp', active: true },
  ] } as never)
})

describe('ConfigPanel · interview_start flow picker (FLOW-EDITOR-1 seam)', () => {
  it('renders the picker, fetches the flows route, and clears back to the vacancy default as empty string', async () => {
    const onUpdate = vi.fn()
    render(<ConfigPanel node={node} onUpdate={onUpdate} onDelete={vi.fn()} />)
    // The lookup select must hit the REAL route.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/interview-flows'))
    // The stored flow renders as the current choice.
    const trigger = await screen.findByRole('button', { name: /Logistiek/ })
    fireEvent.click(trigger)
    // Picking the ''-option (the schema's placeholder copy, raw key here) must
    // write '' — the engine's vacancy/application fallback.
    const emptyOption = await screen.findByText(/Standaard van de vacature\/sollicitatie|fieldPlaceholders/)
    fireEvent.click(emptyOption)
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('n1', 'interview_flow_id', ''))
  })
})
