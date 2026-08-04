/**
 * KoiosModelPicker — K-37 (Danny 05-08): the composer's model picker must show
 * the tenant-facing STAND name (Snel/Slim/Max), never the raw vendor model id.
 * Uses the real i18n instance (ns 'koios' already ships models.tier.* in every
 * locale) so this proves the actual translated string renders, not a stub.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosModelPicker from './KoiosModelPicker'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts)

const MODELS = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8']

describe('KoiosModelPicker — stand names, never the vendor id', () => {
  it('shows the active model as its stand label ("Snel"), not the raw id', () => {
    render(<KoiosModelPicker models={MODELS} value="claude-haiku-4-5" onChange={vi.fn()} t={t} />)
    expect(screen.getByText('Snel')).toBeInTheDocument()
    expect(screen.queryByText('claude-haiku-4-5')).not.toBeInTheDocument()
  })

  it('lists every option by its stand label in the dropdown', () => {
    render(<KoiosModelPicker models={MODELS} value="claude-haiku-4-5" onChange={vi.fn()} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Snel' }))
    expect(screen.getByText('Slim')).toBeInTheDocument()
    expect(screen.getByText('Max')).toBeInTheDocument()
  })

  it('falls back to the raw id for a model outside the known tier whitelist', () => {
    render(<KoiosModelPicker models={['gpt-4o', 'claude-haiku-4-5']} value="gpt-4o" onChange={vi.fn()} t={t} />)
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
  })

  it('renders nothing with fewer than two selectable models (single-model tenants)', () => {
    const { container } = render(<KoiosModelPicker models={['claude-haiku-4-5']} value="claude-haiku-4-5" onChange={vi.fn()} t={t} />)
    expect(container).toBeEmptyDOMElement()
  })
})
