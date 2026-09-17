import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecordStatusBadge from './RecordStatusBadge'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }) }))

// The shared badge maps a status to its label and renders the unknown label without one.
describe('RecordStatusBadge', () => {
  it('renders the raw status as the label fallback', () => {
    render(<RecordStatusBadge status="actief" />)
    expect(screen.getByText('actief')).toBeInTheDocument()
  })

  it('renders the unknown label when no status is given', () => {
    render(<RecordStatusBadge />)
    expect(screen.getByText('candidates.unknown')).toBeInTheDocument()
  })
})
