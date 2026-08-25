/**
 * logChips — DirectionPill / StatusPill. Covers the `label`/`title` addition
 * (WA-MSG-TABLE-2, K-194): every EXISTING caller (no `label` passed) must keep
 * rendering the raw `status` string byte-identically, and a caller that does
 * pass `label` must render that translated text instead, with the tooltip.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import { DirectionPill, StatusPill, isInbound } from './logChips'

describe('isInbound', () => {
  it('accepts the common backend spellings', () => {
    expect(isInbound('in')).toBe(true)
    expect(isInbound('inbound')).toBe(true)
    expect(isInbound('received')).toBe(true)
    expect(isInbound('incoming')).toBe(true)
    expect(isInbound('out')).toBe(false)
    expect(isInbound(undefined)).toBe(false)
  })
})

describe('DirectionPill', () => {
  it('renders the translated in/out word by direction', () => {
    render(<DirectionPill direction="inbound" />)
    expect(screen.getByText(/inkomend|in\b/i)).toBeInTheDocument()
  })
})

describe('StatusPill', () => {
  it('without a label prop, renders the raw status string byte-identically (existing callers)', () => {
    render(<StatusPill status="delivered" />)
    expect(screen.getByText('delivered')).toBeInTheDocument()
  })

  it('with a label prop, renders the translated label instead of the raw status', () => {
    render(<StatusPill status="delivered" label="Afgeleverd" />)
    expect(screen.getByText('Afgeleverd')).toBeInTheDocument()
    expect(screen.queryByText('delivered')).not.toBeInTheDocument()
  })

  it('renders the title tooltip when given, without changing the visible text', () => {
    render(<StatusPill status="failed" label="Mislukt" title="Failed: 20-08-2026 10:00 · timeout" />)
    const chip = screen.getByText('Mislukt')
    expect(chip).toHaveAttribute('title', 'Failed: 20-08-2026 10:00 · timeout')
  })

  it('renders a muted dash when status is absent', () => {
    render(<StatusPill status={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
