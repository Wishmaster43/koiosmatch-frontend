/**
 * HelloflexContractMapSettings (HF-CONTRACTMAP-1) — asserts the real save-request
 * body: GET/POST /settings via the shared settingsApi helpers, keyed off the
 * tenant's own candidate_types lookup (never a hardcoded slug list), one JSON
 * blob under `helloflex_contract_type_map` (§13 — proves the seam, not just a
 * callback firing).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import HelloflexContractMapSettings from './HelloflexContractMapSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const mockUseLookups = vi.fn()
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => mockUseLookups() }))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

beforeEach(() => {
  vi.clearAllMocks()
  mockUseLookups.mockReturnValue({
    candidateTypes: [
      { value: 'temp_agency', label: 'Uitzend', color: '#6B7280' },
      { value: 'payroll', label: 'Payroll', color: '#6B7280' },
    ],
  })
  vi.mocked(api.post).mockResolvedValue({ data: {} })
})

describe('HelloflexContractMapSettings — loading', () => {
  it('renders one GUID+label row per tenant contract-form lookup value', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    render(<HelloflexContractMapSettings />)
    expect(await screen.findByText('Uitzend')).toBeInTheDocument()
    expect(screen.getByText('Payroll')).toBeInTheDocument()
  })

  it('pre-fills rows from the stored JSON map', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { helloflex_contract_type_map: JSON.stringify({
      temp_agency: { guid: 'guid-1', label: 'Uitzendkracht' },
    }) } })
    render(<HelloflexContractMapSettings />)
    expect(await screen.findByDisplayValue('guid-1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Uitzendkracht')).toBeInTheDocument()
  })
})

describe('HelloflexContractMapSettings — saving', () => {
  it('POSTs the JSON map keyed by slug, empty rows omitted (empty mapping stays legal)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<HelloflexContractMapSettings />)
    await screen.findByText('Uitzend')

    // Ids are per-slug (`hf-map-guid-<slug>`) while the visible labels repeat per row,
    // so the id is the one unambiguous handle for a specific contract form's inputs.
    const guidInput = document.getElementById('hf-map-guid-temp_agency') as HTMLInputElement
    const labelInput = document.getElementById('hf-map-label-temp_agency') as HTMLInputElement
    await user.type(guidInput, 'guid-abc')
    await user.type(labelInput, 'Uitzendkracht')

    const saveBtn = screen.getByRole('button', { name: t('common.save') })
    await user.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', {
      helloflex_contract_type_map: JSON.stringify({ temp_agency: { guid: 'guid-abc', label: 'Uitzendkracht' } }),
    }))
    expect(guidInput.value).toBe('guid-abc')
  })

  it('can clear a mapping back to empty (deletable, never stuck) and saves the empty map', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { helloflex_contract_type_map: JSON.stringify({
      temp_agency: { guid: 'guid-1', label: 'Uitzendkracht' },
    }) } })
    const user = userEvent.setup()
    render(<HelloflexContractMapSettings />)
    const guidInput = await screen.findByDisplayValue('guid-1')
    const labelInput = screen.getByDisplayValue('Uitzendkracht')
    await user.clear(guidInput)
    await user.clear(labelInput)

    await user.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings', { helloflex_contract_type_map: '{}' }))
  })
})
