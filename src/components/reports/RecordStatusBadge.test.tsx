import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecordStatusBadge from './RecordStatusBadge'

// Key-echo t(); `known` toggles whether the locale carries the status key.
const known = vi.hoisted(() => ({ value: false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { exists: () => known.value } }) }))

// The shared badge maps a status to its label and renders the unknown label without one.
describe('RecordStatusBadge', () => {
  it('renders the raw status as the label fallback', () => {
    render(<RecordStatusBadge status="actief" />)
    expect(screen.getByText('actief')).toBeInTheDocument()
  })

  it('renders the translated key when the locale has one', () => {
    known.value = true
    render(<RecordStatusBadge status="active" />)
    expect(screen.getByText('candidates.status.active')).toBeInTheDocument()
    known.value = false
  })

  it('renders the unknown label when no status is given', () => {
    render(<RecordStatusBadge />)
    expect(screen.getByText('candidates.unknown')).toBeInTheDocument()
  })
})
