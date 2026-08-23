/**
 * EntityChangelog — asserts the REQUEST (subject_type/subject_id query params,
 * CLAUDE.md §13) and the old→new diff rendering, mirroring the per-entity
 * ChangelogTab tests.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EntityChangelog from './EntityChangelog'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (res: { data: unknown }) => ({ rows: (res as { data: unknown[] }).data ?? [] }),
}))

describe('EntityChangelog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requests /activity-log with subject_type and subject_id params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    render(<EntityChangelog subjectType="Location" subjectId="loc-1" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/activity-log',
      expect.objectContaining({ params: { subject_type: 'Location', subject_id: 'loc-1' } }),
    ))
  })

  // CHANGELOG-FLAKE-1: a malformed payload whose rows are NOT an array must
  // degrade to the empty state, never crash items.map in an async window (the
  // uncaught-exception noise the full suite carried).
  it('renders the empty state when the payload rows are not an array', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { unexpected: 'object' } } })
    render(<EntityChangelog subjectType="Location" subjectId="loc-1" />)
    await waitFor(() => expect(screen.getByText(/geen entries gevonden|no entries/i)).toBeInTheDocument())
  })

  // F1c: an entity with a dedicated activity route passes it via `endpoint` —
  // the request hits that URL verbatim, without /activity-log params.
  it('requests the dedicated endpoint verbatim when given', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    render(<EntityChangelog endpoint="/planning/shifts/7/activity" />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/planning/shifts/7/activity')
    expect((config as { params?: unknown } | undefined)?.params).toBeUndefined()
  })

  it('omits subject_id when not given (type-only filter, e.g. Settings)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    render(<EntityChangelog subjectType="Setting" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/activity-log',
      expect.objectContaining({ params: { subject_type: 'Setting' } }),
    ))
  })

  it('renders one old → new row per changed field', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{
        id: 1, description: 'updated', causer_name: 'Jane', created_at: '2026-08-01T10:00:00Z',
        changes: { attributes: { name: 'New Name' }, old: { name: 'Old Name' } },
      }],
    })
    render(<EntityChangelog subjectType="Location" subjectId="loc-1" />)
    expect(await screen.findByText('New Name')).toBeTruthy()
    expect(screen.getByText('Old Name')).toBeTruthy()
  })

  // Settings audit WITHOUT performedOn (subject_type NULL) — the shared button
  // filters on log_name instead; subject_type must be absent from the request.
  it('filters on log_name for manually-audited streams (settings)', async () => {
    render(<EntityChangelog logName="settings" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/activity-log',
      expect.objectContaining({ params: { log_name: 'settings' } })))
  })

  // CHANGELOG-ACTOR-LABEL: a Koios-performed action carries actor_label
  // ("<name>-KoiosAI") next to causer_name — it must win over the human name.
  // ACTORLABEL-ENDPOINT-1 shipped (CMBE, 23-08): /activity-log's formatEntry
  // now emits the field too, so this fixture models the real envelope.
  it('renders actor_label instead of causer_name when both are present', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{
        id: 1, description: 'updated', causer_name: 'Jane', actor_label: 'Vacature Flow-KoiosAI',
        created_at: '2026-08-01T10:00:00Z',
      }],
    })
    render(<EntityChangelog subjectType="Location" subjectId="loc-1" />)
    expect(await screen.findByText(/Vacature Flow-KoiosAI/)).toBeInTheDocument()
    expect(screen.queryByText(/Jane/)).not.toBeInTheDocument()
  })

  // Row without actor_label falls back to causer_name, unaffected by the new field.
  it('falls back to causer_name when actor_label is absent', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: 1, description: 'updated', causer_name: 'Jane', created_at: '2026-08-01T10:00:00Z' }],
    })
    render(<EntityChangelog subjectType="Location" subjectId="loc-1" />)
    expect(await screen.findByText(/Jane/)).toBeInTheDocument()
  })
})
