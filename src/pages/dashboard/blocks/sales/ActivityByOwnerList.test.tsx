/**
 * ActivityByOwnerList — asserts rows render including zero-activity owners,
 * unassigned label mapping, and that rows are inert (no click).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('rows carry no role=button (inert)', () => {
    const { container } = render(<ActivityByOwnerList rows={rows} />)
    expect(container.querySelectorAll('[role="button"]').length).toBe(0)
  })
})
