/**
 * ChangelogTab · the isStageOnlyChange dedupe predicate (§3A(d)): an audit entry
 * whose ONLY changed attribute is `application_stage_id` is already covered by the
 * Tijdlijn tab's own phrasing, so it is filtered out of this feed. Any entry that
 * changes the stage ALONGSIDE another field, or that has no diff bag at all
 * (system entries), stays. useApplicationActivity is stubbed so this file only
 * tests ChangelogTab's own filtering, not the hook's fetch.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChangelogTab from './ChangelogTab'
import type { ApplicationActivityEvent } from '../hooks/useApplicationActivity'
import type { ApplicationDetail } from '@/types/application'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))

const mockUseActivity = vi.fn()
vi.mock('../hooks/useApplicationActivity', () => ({ useApplicationActivity: (id?: unknown) => mockUseActivity(id) }))

const app = { id: 1 } as ApplicationDetail
const setItems = (items: ApplicationActivityEvent[], over: Partial<{ loading: boolean; error: boolean }> = {}) =>
  mockUseActivity.mockReturnValue({ items, loading: false, error: false, ...over })

describe('ChangelogTab · isStageOnlyChange dedupe', () => {
  it('suppresses a row whose ONLY changed attribute is application_stage_id', () => {
    setItems([
      { id: 'e1', causer_name: 'Jill', created_at: '2026-07-10', description: 'Stage changed',
        changes: { attributes: { application_stage_id: 'hired' } } },
    ])
    render(<ChangelogTab application={app} />)
    expect(screen.queryByText('Jill')).toBeNull()
    expect(screen.getByText('changelog.empty')).toBeInTheDocument()
  })

  it('keeps a row that changes the stage ALONGSIDE another field', () => {
    setItems([
      { id: 'e2', causer_name: 'Bob', created_at: '2026-07-10', description: 'Stage + owner changed',
        changes: { attributes: { application_stage_id: 'hired', owner_id: 'u2' } } },
    ])
    render(<ChangelogTab application={app} />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Stage + owner changed')).toBeInTheDocument()
  })

  it('keeps a row that changed a single NON-stage field', () => {
    setItems([
      { id: 'e3', causer_name: 'Ann', created_at: '2026-07-10', description: 'Notes changed',
        changes: { attributes: { notes: 'y' } } },
    ])
    render(<ChangelogTab application={app} />)
    expect(screen.getByText('Ann')).toBeInTheDocument()
  })

  it('keeps a row with no diff bag at all (system entry without a changes payload)', () => {
    setItems([{ id: 'e4', causer_name: 'System', created_at: '2026-07-10', description: 'Created' }])
    render(<ChangelogTab application={app} />)
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('keeps a row whose attributes bag is present but empty', () => {
    setItems([{ id: 'e5', causer_name: 'Empty-bag', created_at: '2026-07-10', description: 'x', changes: { attributes: {} } }])
    render(<ChangelogTab application={app} />)
    expect(screen.getByText('Empty-bag')).toBeInTheDocument()
  })

  it('mixes suppressed and kept rows in the same feed, in order', () => {
    setItems([
      { id: 'e1', causer_name: 'Jill', created_at: '2026-07-10', description: 'Stage only',
        changes: { attributes: { application_stage_id: 'hired' } } },
      { id: 'e2', causer_name: 'Bob', created_at: '2026-07-11', description: 'Mixed change',
        changes: { attributes: { application_stage_id: 'hired', owner_id: 'u2' } } },
      { id: 'e3', causer_name: 'Ann', created_at: '2026-07-12', description: 'Notes only',
        changes: { attributes: { notes: 'y' } } },
    ])
    render(<ChangelogTab application={app} />)
    expect(screen.queryByText('Jill')).toBeNull()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Ann')).toBeInTheDocument()
  })

  it('renders the empty state when every entry is stage-only', () => {
    setItems([
      { id: 'e1', causer_name: 'Jill', created_at: '2026-07-10', description: 'a', changes: { attributes: { application_stage_id: 'x' } } },
      { id: 'e2', causer_name: 'Bob', created_at: '2026-07-11', description: 'b', changes: { attributes: { application_stage_id: 'y' } } },
    ])
    render(<ChangelogTab application={app} />)
    expect(screen.getByText('changelog.empty')).toBeInTheDocument()
  })
})
