import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacancyTab from './VacancyTab'
import { peekReturnTab } from './constants'
import type { ApplicationDetail } from '@/types/application'

// Stub the api client + the reused vacancy detail (avoids its lookups context).
// Keep the real unwrap/unwrapList (importActual): VacancyTab itself now unwraps a
// single resource, and useVacancyLinkOptions pulls in unwrapList — a partial mock
// left either undefined at load time.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
// S20: the mock exposes onUpdate so a test can prove it actually fires a PATCH
// (the whole point of the fix — DetailsTab's pencils used to no-op here).
vi.mock('@/pages/vacancies/drawer/DetailsTab', () => ({
  default: ({ onUpdate }: { onUpdate?: (id: number, patch: Record<string, unknown>) => void }) => (
    <div>
      details-tab
      <button onClick={() => onUpdate?.(7, { skills: ['Triage'] })}>save-skill</button>
    </div>
  ),
}))
// Danny 21-07: Beschrijving now renders alongside DetailsTab in this drill-down
// (its own drawer main-tab on the real vacancy has no equivalent tab bar here).
vi.mock('@/pages/vacancies/drawer/DescriptionTab', () => ({
  default: () => <div>description-tab</div>,
}))
vi.mock('@/context/VacancyLookupsContext', () => ({ VacancyLookupsProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// Minimal application detail — only vacancyId drives this tab.
const app = (over: Partial<ApplicationDetail> = {}) => ({ id: 1, vacancyId: 7, ...over } as unknown as ApplicationDetail)

describe('VacancyTab', () => {
  // VACTAB-TEST-1 root cause (bisected 2026-07-15): `beforeEach(() => mockGet.mockReset())`
  // implicitly RETURNED the mock (mockReset() returns `this`) — vitest treats a function
  // returned from beforeEach as a cleanup hook and CALLED api.get() with no args after
  // every test, producing an unhandled 'boom' rejection that deadlocked the runner.
  // Braces (statement body, no implicit return) are load-bearing here.
  beforeEach(() => { mockGet.mockReset(); mockPatch.mockReset(); mockPatch.mockResolvedValue({ data: { data: {} } }) })

  it('shows the empty state when no vacancy is linked', () => {
    render(<VacancyTab application={app({ vacancyId: null })} />)
    expect(screen.getByText('vacancyDetail.empty')).toBeInTheDocument()
  })

  it('shows the loading state while fetching', () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    render(<VacancyTab application={app()} />)
    expect(screen.getByText('vacancyDetail.loading')).toBeInTheDocument()
  })

  it('shows the error state when the fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    render(<VacancyTab application={app()} />)
    expect(await screen.findByText('vacancyDetail.error')).toBeInTheDocument()
  })

  it('renders the reused vacancy detail on success', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    render(<VacancyTab application={app()} />)
    expect(await screen.findByText('details-tab')).toBeInTheDocument()
  })

  // Danny 21-07: Beschrijving moved to its own drawer main-tab on the real
  // vacancy — this drill-down has no tab bar, so it must stay visible below Details.
  it('renders the description tab alongside the details tab', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    render(<VacancyTab application={app()} />)
    expect(await screen.findByText('description-tab')).toBeInTheDocument()
  })

  // S20: the reused DetailsTab's onUpdate must actually PATCH /vacancies/{id} —
  // it used to be omitted entirely, so every edit (incl. "Vereiste vaardigheden")
  // silently did nothing.
  it('persists a DetailsTab edit via PATCH /vacancies/{id}', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    const user = userEvent.setup()
    render(<VacancyTab application={app()} />)
    await user.click(await screen.findByText('save-skill'))
    expect(mockPatch).toHaveBeenCalledWith('/vacancies/7', { skills: ['Triage'] })
  })

  // S14/S22: clicking through to the full vacancy stashes 'vacancy' as the return
  // tab, so browser BACK reopens this application's drawer on the Vacature tab.
  it('stashes the return tab before navigating to the full vacancy', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    const user = userEvent.setup()
    render(<VacancyTab application={app({ id: 9 })} />)
    const openLink = await screen.findByTitle('drawer.openVacancy')
    await user.click(openLink)
    expect(peekReturnTab(9)).toBe('vacancy')
  })

  // Danny 21-07: "Open vacancy" must be a REAL new-tab anchor (href + target=_blank),
  // not the in-app EntityLink button it used to be wrapped in.
  it('renders "Open vacancy" as a real new-tab anchor', async () => {
    mockGet.mockResolvedValue({ data: { data: { id: 7, title: 'Verpleegkundige' } } })
    render(<VacancyTab application={app()} />)
    const openLink = await screen.findByTitle('drawer.openVacancy')
    expect(openLink.tagName).toBe('A')
    expect(openLink.getAttribute('href')).toContain('?open=7')
    expect(openLink.getAttribute('target')).toBe('_blank')
    expect(openLink.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
