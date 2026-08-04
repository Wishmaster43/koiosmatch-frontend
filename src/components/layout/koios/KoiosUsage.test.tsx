/**
 * KoiosUsage — K-37 (Danny 05-08): the per-message usage line must show the
 * tenant-facing stand name (Snel/Slim/Max) in place of the raw vendor model id
 * the backend returns in `model`/`usage.model`. Uses the real i18n instance so
 * this asserts the actual rendered string, not a stubbed translator.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosUsage from './KoiosUsage'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string

describe('KoiosUsage — stand name, never the vendor id', () => {
  it('renders the stand label ("Slim") for a known model id, not the raw id', () => {
    render(<KoiosUsage model="claude-sonnet-5" usage={{ input_tokens: 10, output_tokens: 20, cost: 0 }} t={t} />)
    expect(screen.getByText(/Slim/)).toBeInTheDocument()
    expect(screen.queryByText(/claude-sonnet-5/)).not.toBeInTheDocument()
  })

  it('falls back to usage.model when the message carries no model of its own', () => {
    render(<KoiosUsage model={null} usage={{ input_tokens: 1, output_tokens: 1, cost: 0, model: 'claude-opus-4-8' }} t={t} />)
    expect(screen.getByText(/Max/)).toBeInTheDocument()
  })

  it('falls back to the raw id for a model outside the known tier whitelist', () => {
    render(<KoiosUsage model="gpt-4o" usage={{ input_tokens: 1, output_tokens: 1, cost: 0 }} t={t} />)
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument()
  })
})
