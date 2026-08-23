/**
 * ChangelogTab (customer) · K20 (13-08) regression: the backend DOES send a
 * per-field diff bag (`changes`, Spatie {attributes, old} shape) — this now
 * renders one old → new row per changed field instead of a plain description
 * line, and labels sub-entity entries via `subject_type`.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ChangelogTab from './ChangelogTab'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/lib/mocks', () => ({ isAbortError: () => false }))

const get = vi.fn()
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: (...args: unknown[]) => get(...args) } }
})

describe('ChangelogTab (customer) · K20 per-field old → new diffs', () => {
  it('renders one old → new row per changed field, with the causer and date', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [{
          id: 'ev-1', causer_name: 'Danny Polak', created_at: '2026-08-13T10:00:00Z',
          event: 'updated',
          changes: { attributes: { name: 'Nieuwe naam', city: 'Amsterdam' }, old: { name: 'Oude naam', city: 'Amsterdam' } },
        }],
      },
    })
    const { container } = render(<ChangelogTab customerId="cust-1" />)

    // "name" changed (old → new) — one row.
    await waitFor(() => expect(screen.getByText('Oude naam')).toBeInTheDocument())
    expect(screen.getByText('Nieuwe naam')).toBeInTheDocument()
    // "city" did NOT change (old === new) — no row for it.
    expect(screen.queryByText('Amsterdam')).not.toBeInTheDocument()
    // The header line carries the causer (mixed with " · " text nodes, so
    // matched against the whole card's text rather than an isolated node).
    expect(container.textContent).toContain('Danny Polak')
  })

  // ACTORLABEL-SWEEP-1: actor_label ("<name>-KoiosAI") wins over causer_name when present.
  it('shows actor_label instead of causer_name when both are present', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [{
          id: 'ev-4', causer_name: 'Danny Polak', actor_label: 'Danny Polak-KoiosAI', created_at: '2026-08-13T10:00:00Z',
          event: 'updated',
          changes: { attributes: { name: 'Nieuwe naam' }, old: { name: 'Oude naam' } },
        }],
      },
    })
    const { container } = render(<ChangelogTab customerId="cust-1" />)
    await waitFor(() => expect(container.textContent).toContain('Danny Polak-KoiosAI'))
  })

  it('labels a sub-entity entry via subject_type', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [{
          id: 'ev-2', causer_name: 'Danny Polak', created_at: '2026-08-13T10:00:00Z',
          event: 'updated', subject_type: 'CustomerLocation',
          changes: { attributes: { street: 'Nieuwe straat' }, old: { street: 'Oude straat' } },
        }],
      },
    })
    render(<ChangelogTab customerId="cust-1" />)
    expect(await screen.findByText('changelog.subjectTypes.location')).toBeInTheDocument()
  })

  it('falls back to the plain description line when an entry carries no diff bag', async () => {
    get.mockResolvedValueOnce({
      data: { data: [{ id: 'ev-3', causer_name: 'Danny Polak', created_at: '2026-08-13T10:00:00Z', description: 'Klant verwijderd' }] },
    })
    render(<ChangelogTab customerId="cust-1" />)
    expect(await screen.findByText('Klant verwijderd')).toBeInTheDocument()
  })

  it('shows the empty state when the endpoint returns nothing', async () => {
    get.mockResolvedValueOnce({ data: { data: [] } })
    render(<ChangelogTab customerId="cust-1" />)
    await waitFor(() => expect(screen.getByText('changelog.empty')).toBeInTheDocument())
  })
})
