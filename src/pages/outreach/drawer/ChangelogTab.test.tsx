/**
 * ChangelogTab (bellijst) — the LAST entity to get a change log. These tests guard
 * the seam, not the callback: the request assertion pins method + exact route, so a
 * renamed/typo'd endpoint fails here instead of 404-ing silently in production. Plus
 * the four UI states, with the important nuance that an EMPTY history is the normal
 * state for a fresh campaign (calm empty state, never the error banner).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch copy.
import '@/i18n'
import nlOutreach from '@/i18n/locales/nl/outreach.json'
import ChangelogTab from './ChangelogTab'

// Mock only the axios client; unwrapList stays REAL so the test also proves the
// component reads the backend's { data: [...] } envelope correctly.
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: getMock } }
})

// One audit entry in the shared LogsEntityActivity shape (event + causer + diff bag).
const entry = {
  id: 'a1', event: 'updated', description: 'updated', causer_name: 'Danny Polak',
  created_at: '2026-07-10T09:00:00Z',
  changes: {
    attributes: { name: 'Bellijst Zorg Noord', status: 'active', owner_id: '11111111-2222-3333-4444-555555555555' },
    old:        { name: 'Bellijst Zorg',       status: 'draft',  owner_id: '99999999-2222-3333-4444-555555555555' },
  },
}

beforeEach(() => { getMock.mockReset() })

describe('ChangelogTab · bellijst change log', () => {
  it('GETs the campaign activity route with an abort signal', async () => {
    getMock.mockResolvedValue({ data: { data: [] } })
    render(<ChangelogTab campaignId="c1" />)
    // THE SEAM: exact method + route. A wrong path would 404 and silently render empty.
    await waitFor(() => expect(getMock).toHaveBeenCalledWith(
      '/outreach-campaigns/c1/activity',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('never fetches without an id (no /outreach-campaigns/null/activity call)', () => {
    render(<ChangelogTab campaignId={null} />)
    expect(getMock).not.toHaveBeenCalled()
    expect(screen.getByText(nlOutreach.changelog.empty)).toBeInTheDocument()
  })

  it('renders one card per changed field, with translated enum values and the actor', async () => {
    getMock.mockResolvedValue({ data: { data: [entry] } })
    render(<ChangelogTab campaignId="c1" />)

    // Plain text diff: old → new.
    expect(await screen.findByText('Bellijst Zorg')).toBeInTheDocument()
    expect(screen.getByText('Bellijst Zorg Noord')).toBeInTheDocument()
    // The status enum resolves to its tenant-facing label, not the raw slug.
    expect(screen.getByText(nlOutreach.status.draft)).toBeInTheDocument()
    expect(screen.getByText(nlOutreach.status.active)).toBeInTheDocument()
    // A raw uuid reference is unreadable → the neutral "bijgewerkt" line instead.
    expect(screen.getByText(nlOutreach.changelog.updatedValue)).toBeInTheDocument()
    // Three changed fields → three cards, each carrying the actor + humanized verb.
    expect(screen.getAllByText(/Danny Polak/)).toHaveLength(3)
    expect(screen.getAllByText(new RegExp(nlOutreach.changelog.actions.updated))).toHaveLength(3)
  })

  // ACTORLABEL-SWEEP-1: actor_label ("<name>-KoiosAI") wins over causer_name when present.
  it('shows actor_label instead of causer_name when both are present', async () => {
    getMock.mockResolvedValue({ data: { data: [{ ...entry, actor_label: 'Danny Polak-KoiosAI' }] } })
    render(<ChangelogTab campaignId="c1" />)
    expect(await screen.findAllByText(/Danny Polak-KoiosAI/)).toHaveLength(3)
    expect(screen.queryByText(/^Danny Polak(?!-KoiosAI)/)).toBeNull()
  })

  it('falls back to causer_name when actor_label is absent', async () => {
    getMock.mockResolvedValue({ data: { data: [entry] } })
    render(<ChangelogTab campaignId="c1" />)
    expect(await screen.findAllByText(/Danny Polak/)).toHaveLength(3)
  })

  it('shows the calm empty state for a fresh campaign, not an error', async () => {
    getMock.mockResolvedValue({ data: { data: [] } })
    render(<ChangelogTab campaignId="c1" />)
    expect(await screen.findByText(nlOutreach.changelog.empty)).toBeInTheDocument()
    expect(screen.queryByText(nlOutreach.changelog.error)).toBeNull()
  })

  it('treats a 404 as empty (stale/hard-deleted id) but a 500 as a real error', async () => {
    getMock.mockRejectedValue({ response: { status: 404 } })
    const { unmount } = render(<ChangelogTab campaignId="c1" />)
    expect(await screen.findByText(nlOutreach.changelog.empty)).toBeInTheDocument()
    unmount()

    getMock.mockRejectedValue({ response: { status: 500 } })
    render(<ChangelogTab campaignId="c2" />)
    expect(await screen.findByText(nlOutreach.changelog.error)).toBeInTheDocument()
  })

  it('shows the loading state while the request is in flight', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    render(<ChangelogTab campaignId="c1" />)
    expect(screen.getByText(nlOutreach.changelog.loading)).toBeInTheDocument()
  })
})
