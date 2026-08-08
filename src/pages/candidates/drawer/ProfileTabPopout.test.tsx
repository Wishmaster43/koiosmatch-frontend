/**
 * ProfileTab · profile-text pop-out (TEKST-POPOUT-1, Danny 08-08 punt 2).
 *
 * Its own file rather than an addition to ProfileTab.test.tsx: that file is being
 * edited by a parallel lane, and these tests need a different mock set (window.open
 * + notify) that the layout tests there must not inherit.
 *
 * What is pinned: the icon opens the REAL second-screen route (the URL is the
 * contract between the two windows, §13 — assert the request, not that a handler
 * fired), popping out starts the edit here so the draft can never be stranded in
 * the closed window, and a blocked popup says so instead of failing silently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileTab from './ProfileTab'
import { notifyError } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/api', () => ({
  getActiveTenantId: () => 'demo', default: { get: vi.fn(() => Promise.reject({ response: { status: 404 } })) } }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [] }) }))
vi.mock('@/lib/useNationalities', () => ({ useNationalities: () => ({ nationalities: [] }) }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: [] }) }))
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => <div data-testid="summary-editor" /> }))
vi.mock('@/components/ui/SafeHtml', () => ({ default: () => null }))
vi.mock('./useWorkPermitVisibility', () => ({ useWorkPermitVisibility: () => false }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notify: vi.fn() }))

describe('ProfileTab · profile-text pop-out', () => {
  const candidate = {
    id: 'c1', gender: '', nationality: '', dob: '', placeOfBirth: '', street: '', houseNumber: '',
    houseNumberSuffix: '', postalCode: '', city: '', province: '', country: 'NL', email: '', phone: '',
    mobile: '', linkedin: '', summary: '<p>Ervaren</p>', phase: 'candidate',
  } as unknown as Candidate

  beforeEach(() => vi.clearAllMocks())

  it('opens the second-screen window on the text-popout route for this candidate', async () => {
    const user = userEvent.setup()
    const open = vi.fn(() => ({}) as Window)
    vi.stubGlobal('open', open)
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getByTitle('Open op tweede scherm'))
    expect(open).toHaveBeenCalledWith('/popout/text/candidate/c1/summary', 'koios-text-candidate-c1-summary', expect.any(String))
    vi.unstubAllGlobals()
  })

  it('starts editing here as well, so the draft lives in both windows', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('open', vi.fn(() => ({}) as Window))
    render(<ProfileTab c={candidate} />)
    expect(screen.queryByTestId('summary-editor')).toBeNull()
    await user.click(screen.getByTitle('Open op tweede scherm'))
    expect(screen.getByTestId('summary-editor')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('says so when the browser blocks the popup — never a dead icon', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('open', vi.fn(() => null))
    render(<ProfileTab c={candidate} />)
    await user.click(screen.getByTitle('Open op tweede scherm'))
    expect(notifyError).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
