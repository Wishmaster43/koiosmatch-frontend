import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (this tab has no datetime import to trigger it transitively) —
// explicit side-effect import so t() resolves real Dutch text, like the rest
// of this drawer's tests (never raw keys).
import '@/i18n'
import ProfileContactTab from './ProfileContactTab'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'

// Required-fields lookup mocked directly (own hook, own test) — no need to touch
// the underlying settings/api plumbing that hook already covers separately.
vi.mock('./useProfileRequiredKeys', () => ({ useProfileRequiredKeys: vi.fn(() => []) }))

// waDigits itself moved to src/lib/waDigits.ts + its own test (P1 follow-up,
// 2026-07-20) — this file only covers ProfileContactTab's own render behaviour.
// BE 2026-07-20: phone (landline) and mobile are now independent fields, each
// with exactly ONE fixed shortcut icon — mobile → WhatsApp (wa.me), landline →
// dial — moved here unchanged from the pre-split ProfileTab.test.tsx.
describe('ProfileContactTab · own fields, own pencil, own request shape', () => {
  // Reset to "nothing required" before every test — a test that overrides this
  // (the required-fields case below) must not leak into the others, since the
  // component re-renders (and re-invokes the hook) on every click.
  beforeEach(() => { vi.mocked(useProfileRequiredKeys).mockReturnValue([]) })

  const candidate = { id: 1, phone: '0301234567', mobile: '0612345678', email: 'a@b.nl', linkedin: '', phase: 'candidate' } as unknown as Candidate

  it('renders exactly its own four fields, nothing from Personal/Address', () => {
    render(<ProfileContactTab c={candidate} />)
    expect(screen.getByText('E-mailadres')).toBeInTheDocument()
    expect(screen.getByText('Mobiel')).toBeInTheDocument()
    expect(screen.getByText('Telefoon')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
    expect(screen.queryByText('Geslacht')).toBeNull()
    expect(screen.queryByText('Straat')).toBeNull()
  })

  it('renders the mobile value with only a WhatsApp shortcut (wa.me)', () => {
    render(<ProfileContactTab c={candidate} />)
    const wa = screen.getByTitle('Open in WhatsApp')
    expect(wa.getAttribute('href')).toBe('https://wa.me/31612345678')
    expect(screen.getAllByTitle('Open in WhatsApp')).toHaveLength(1)
  })

  it('renders the landline value with only a call shortcut (tel:), no WhatsApp icon', () => {
    render(<ProfileContactTab c={candidate} />)
    const call = screen.getByTitle('Bellen')
    expect(call.getAttribute('href')).toBe('tel:0301234567')
    expect(screen.getAllByTitle('Bellen')).toHaveLength(1)
  })

  it('hides the WhatsApp icon for a mobile value too short to be a real MSISDN', () => {
    const c = { id: 1, phone: '', mobile: '0612', phase: 'candidate' } as unknown as Candidate
    render(<ProfileContactTab c={c} />)
    expect(screen.queryByTitle('Open in WhatsApp')).toBeNull()
  })

  it('the pencil flips only this tab into edit mode', async () => {
    const user = userEvent.setup()
    render(<ProfileContactTab c={candidate} />)
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(1)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByTitle('Opslaan')).toBeInTheDocument()
    expect(screen.queryByTitle('Bewerken')).toBeNull()
  })

  it('sends the full contact field set on save (assert the REQUEST body)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ProfileContactTab c={candidate} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const linkedinRow = screen.getByText('LinkedIn').parentElement as HTMLElement
    const linkedinInput = within(linkedinRow).getByRole('textbox') as HTMLInputElement
    await user.type(linkedinInput, 'linkedin.com/in/test')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ email: 'a@b.nl', mobile: '0612345678', phone: '0301234567', linkedin: 'linkedin.com/in/test' })
  })

  it('blocks save and flags email/phone when the tenant requires them', async () => {
    vi.mocked(useProfileRequiredKeys).mockReturnValue(['email', 'phone'])
    const user = userEvent.setup()
    const empty = { id: 2, email: '', phone: '', mobile: '', linkedin: '', phase: 'candidate' } as unknown as Candidate
    const onSave = vi.fn()
    render(<ProfileContactTab c={empty} onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getAllByText('Verplicht veld').length).toBe(2)
  })
})
