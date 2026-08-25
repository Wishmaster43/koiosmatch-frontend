/**
 * ActivityByOwnerList — asserts rows render including zero-activity owners,
 * unassigned label mapping, and that a real-owner row navigates by owner id
 * while the null-owner (unassigned) row stays inert.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActivityByOwnerList from './ActivityByOwnerList'
import type { ActivityByOwnerRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { count?: number }) => opts ? `${k}:${opts.count}` : k }) }))

const rows: ActivityByOwnerRow[] = [
  { owner_id: '1', name: 'Alice', activity: 10 },
  { owner_id: null, name: 'x', activity: 0 },
]

describe('ActivityByOwnerList', () => {
  it('renders zero-activity owners and maps unassigned', () => {
    render(<ActivityByOwnerList rows={rows} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('feed.unassigned')).toBeInTheDocument()
  })

  it('self-hides on an empty feed', () => {
    const { container } = render(<ActivityByOwnerList rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('only one row (the real owner) carries role=button — the unassigned row stays inert', () => {
    const { container } = render(<ActivityByOwnerList rows={rows} onNavigate={vi.fn()} />)
    expect(container.querySelectorAll('[role="button"]').length).toBe(1)
  })

  it('clicking the owner row navigates to opportunities filtered by owner id', () => {
    const onNavigate = vi.fn()
    render(<ActivityByOwnerList rows={rows} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Alice').closest('[role="button"]')!)
    expect(onNavigate).toHaveBeenCalledWith('opportunities', { owner: '1' })
  })

  it('the unassigned row does not navigate on click (no handler)', () => {
    const onNavigate = vi.fn()
    render(<ActivityByOwnerList rows={rows} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('feed.unassigned'))
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
