/**
 * ChangelogTab (customer) · K20 (13-08) regression: the backend DOES send a
 * per-field diff bag (`changes`, Spatie {attributes, old} shape) — this now
 * renders one old → new row per changed field instead of a plain description
 * line, and labels sub-entity entries via `subject_type`.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ChangelogTab from './ChangelogTab'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v }) }))
vi.mock('@/lib/abortError', () => ({ isAbortError: () => false }))

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

  // K-ACTLOG-ROLLUP-1: subject_type on the wire is the backend's class_basename
  // (CustomerDocument), not the bare "Document" the map used to carry — that
  // mismatch silently dropped every document event's chip.
  it('labels a document sub-entity entry via its CustomerDocument subject_type', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [{
          id: 'ev-5', causer_name: 'Danny Polak', created_at: '2026-08-13T10:00:00Z',
          event: 'updated', subject_type: 'CustomerDocument',
          changes: { attributes: { file_name: 'contract.pdf' }, old: { file_name: 'draft.pdf' } },
        }],
      },
    })
    render(<ChangelogTab customerId="cust-1" />)
    expect(await screen.findByText('changelog.subjectTypes.document')).toBeInTheDocument()
  })

  // The customer feed is a MERGE of the company's own events and its sub-entities'
  // (server-side roll-up, CustomerController::activityLog) — the tab renders them
  // in the order the server sends them (newest first), each carrying its own chip.
  it('renders a mixed customer + sub-entity feed in server order, each with its own subject chip', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ev-6', causer_name: 'Danny Polak', created_at: '2026-08-15T10:00:00Z',
            event: 'updated', subject_type: 'CustomerContact',
            changes: { attributes: { phone: '0612345678' }, old: { phone: '0698765432' } },
          },
          {
            id: 'ev-7', causer_name: 'Danny Polak', created_at: '2026-08-14T10:00:00Z',
            event: 'updated',
            changes: { attributes: { name: 'Acme B.V.' }, old: { name: 'Acme' } },
          },
        ],
      },
    })
    const { container } = render(<ChangelogTab customerId="cust-1" />)
    await waitFor(() => expect(screen.getByText('changelog.subjectTypes.contact')).toBeInTheDocument())
    // The contact (sub-entity) card renders before the customer's own card,
    // matching the server-sent order — no client-side reordering.
    const contactIdx = container.textContent!.indexOf('0612345678')
    const customerIdx = container.textContent!.indexOf('Acme B.V.')
    expect(contactIdx).toBeGreaterThan(-1)
    expect(customerIdx).toBeGreaterThan(contactIdx)
  })

  // K-ACTLOG-SUBJECT-NAME-1: the chip must name WHICH sub-entity, not only its
  // type — a name map keyed by subject_id, passed in from CustomerDrawer.
  it('names the sub-entity in its chip when the id resolves in the given name map', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [{
          id: 'ev-8', causer_name: 'Danny Polak', created_at: '2026-08-13T10:00:00Z',
          event: 'updated', subject_type: 'CustomerLocation', subject_id: 9,
          changes: { attributes: { street: 'Nieuwe straat' }, old: { street: 'Oude straat' } },
        }],
      },
    })
    render(<ChangelogTab customerId="cust-1" locationNames={{ '9': 'Eindhoven' }} />)
    expect(await screen.findByText('changelog.subjectTypes.location · Eindhoven')).toBeInTheDocument()
  })

  // An id that is not (or no longer) in the map — e.g. a stale/unknown reference —
  // must degrade to the type label alone, never a dangling separator or blank name.
  it('falls back to the type label alone when the subject_id is not in the name map', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: [{
          id: 'ev-9', causer_name: 'Danny Polak', created_at: '2026-08-13T10:00:00Z',
          event: 'updated', subject_type: 'CustomerLocation', subject_id: 42,
          changes: { attributes: { street: 'Nieuwe straat' }, old: { street: 'Oude straat' } },
        }],
      },
    })
    render(<ChangelogTab customerId="cust-1" locationNames={{ '9': 'Eindhoven' }} />)
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
