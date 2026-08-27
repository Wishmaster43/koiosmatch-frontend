/**
 * KoiosModelPicker — K-37 (Danny 05-08): the composer's model picker must show
 * the tenant-facing STAND name (Snel/Slim/Max), never the raw vendor model id.
 * Uses the real i18n instance (ns 'koios' already ships models.tier.* in every
 * locale) so this proves the actual translated string renders, not a stub.
 *
 * KOIOS-MODEL-VOCAB-1 (27-08): the server now serves `selectable[]`/`options[]`
 * as FLAVOUR KEYS (snel/slim/max), not raw vendor ids (see KoiosPanel.tsx —
 * `settings?.models?.selectable` feeds `models` directly). Fixtures below mirror
 * that contract.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosModelPicker from './KoiosModelPicker'
import type { KoiosModelOption } from '@/lib/koiosModelTiers'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts)

const FLAVORS = ['snel', 'slim', 'max']

describe('KoiosModelPicker — stand names, never the vendor id', () => {
  it('shows the active flavour as its stand label ("Snel"), not the raw id', () => {
    render(<KoiosModelPicker models={FLAVORS} value="snel" onChange={vi.fn()} t={t} />)
    expect(screen.getByText('Snel')).toBeInTheDocument()
    expect(screen.queryByText('snel')).not.toBeInTheDocument()
  })

  it('lists every option by its stand label in the dropdown', () => {
    render(<KoiosModelPicker models={FLAVORS} value="snel" onChange={vi.fn()} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Snel' }))
    expect(screen.getByText('Slim')).toBeInTheDocument()
    expect(screen.getByText('Max')).toBeInTheDocument()
  })

  it('falls back to the raw id for a model outside the known flavour/tier whitelist', () => {
    render(<KoiosModelPicker models={['gpt-4o', 'snel']} value="gpt-4o" onChange={vi.fn()} t={t} />)
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
  })

  it('renders nothing with fewer than two selectable models (single-model tenants)', () => {
    const { container } = render(<KoiosModelPicker models={['snel']} value="snel" onChange={vi.fn()} t={t} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('uses the server label + hint for an UN-LISTED id (no flavour/tier match)', () => {
    const options: KoiosModelOption[] = [
      { id: 'custom-vendor-id', label: 'Custom vendor model', hint: 'Server-provided hint text', cost_rank: 2 },
    ]
    render(<KoiosModelPicker models={['custom-vendor-id', 'snel']} options={options} value="custom-vendor-id" onChange={vi.fn()} t={t} />)
    expect(screen.getByText('Custom vendor model')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Custom vendor model' }))
    expect(screen.getByText('Server-provided hint text')).toBeInTheDocument()
  })

  it('renders the TRANSLATED tier label for a known flavour, not the Dutch server label', () => {
    // Server still ships its Dutch-only platform copy for the known flavours —
    // the translated koios.json models.tier.* string must win over it (§5).
    const options: KoiosModelOption[] = [
      { id: 'snel', label: 'Snelst en voordeligst', hint: 'Snelst en voordeligst — prima voor de meeste chats', cost_rank: 1 },
      { id: 'slim', label: 'Slimste keuze', hint: 'Slimste keuze voor de meeste taken', cost_rank: 2 },
    ]
    render(<KoiosModelPicker models={FLAVORS} options={options} value="snel" onChange={vi.fn()} t={t} />)
    expect(screen.getByText('Snel')).toBeInTheDocument()
    expect(screen.queryByText('Snelst en voordeligst')).not.toBeInTheDocument()
  })
})
