/**
 * lookupSelectOwnerLabel.test — K-193 fase 2b: GET /whatsapp-web-numbers returns
 * each connected device with a `label` and an `owner` (user or branch name); the
 * picker must compose "<label> · <owner>" additively, never drop the server's
 * own label, and fall back to the bare label when owner is absent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LookupSelectField } from './fieldControls'
import api from '@/lib/api'

// WhatsappSendLookupController::webNumbers() returns response()->json(['data' => $options]) —
// axios therefore hands back { data: { data: [...] } }, the same wrapped dialect as every
// other Laravel resource collection (§10); mock that exact shape, not the bare-array one.
vi.mock('@/lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: vi.fn().mockResolvedValue({ data: { data: [
    { value: 'w1', label: 'iPhone 12', owner: 'Danny Polak', scope: 'user' },
    { value: 'w2', label: 'Kantoor toestel', owner: 'Amsterdam', scope: 'location' },
    { value: 'w3', label: 'No-owner device' },
  ] } }) },
}))

describe('LookupSelectField · owner/scope label composition', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the exact whatsapp-web-numbers endpoint', async () => {
    render(<LookupSelectField value={undefined} onChange={vi.fn()} fieldKey="whatsapp_number_id" endpoint="/whatsapp-web-numbers" />)
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/whatsapp-web-numbers'))
    expect(vi.mocked(api.get)).toHaveBeenCalledTimes(1)
  })

  it('composes "<label> · <owner>" for user- and location-scoped devices', async () => {
    render(<LookupSelectField value={undefined} onChange={vi.fn()} fieldKey="whatsapp_number_id" endpoint="/whatsapp-web-numbers" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('iPhone 12 · Danny Polak')).toBeInTheDocument())
    expect(screen.getByText('Kantoor toestel · Amsterdam')).toBeInTheDocument()
  })

  it('falls back to the bare label when owner is absent', async () => {
    render(<LookupSelectField value={undefined} onChange={vi.fn()} fieldKey="whatsapp_number_id" endpoint="/whatsapp-web-numbers" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('No-owner device')).toBeInTheDocument())
  })
})
