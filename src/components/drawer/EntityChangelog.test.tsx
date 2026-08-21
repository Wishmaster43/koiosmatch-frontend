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
})
