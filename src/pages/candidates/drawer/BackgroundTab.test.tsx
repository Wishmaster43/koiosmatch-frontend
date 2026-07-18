/**
 * BackgroundTab — Achtergrond tab sub-tab regression tests (Danny
 * kandidaten-ronde-2, punt B). Real i18n (nl) runs here — SectionTabs (imported
 * transitively) pulls in the real @/i18n side-effect init, so `t()` resolves
 * genuine Dutch text (mirrors SectionTabs.test.tsx). Only the Tiptap
 * RichTextEditor is stubbed; the lookup hooks' own GETs (skills/languages) are
 * covered by mocking `@/lib/api` so no real network call fires.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackgroundTab from './BackgroundTab'
import type { Candidate } from '@/types/candidate'

// Resolve (never reject) empty lists: useSkillLevels/useLanguageLookups build on
// the shared useCachedLookup, which chains an un-caught `.finally()` on the raw
// request promise — a rejection there surfaces as an unhandled rejection warning
// unrelated to anything under test here.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

const candidate = (): Candidate => ({ id: 1, experiences: [], educations: [], certifications: [], skills: [], languages: [] } as unknown as Candidate)

describe('BackgroundTab · sub-tabs (kandidaten-ronde-2, punt B)', () => {
  it('renders exactly one sub-tab per section, sorted alphabetically by translated label', () => {
    render(<BackgroundTab c={candidate()} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    // Dutch alphabetical order: Certificeringen · Ervaring · Opleiding · Talen · Vaardigheden.
    expect(tabs).toEqual(['Certificeringen', 'Ervaring', 'Opleiding', 'Talen', 'Vaardigheden'])
  })

  it('defaults the open sub-tab to Ervaring, not the first alphabetically (Certificeringen)', () => {
    render(<BackgroundTab c={candidate()} />)
    expect(screen.getByRole('tab', { name: 'Ervaring' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Nog geen ervaringen.')).toBeInTheDocument()
    expect(screen.queryByText('Nog geen certificeringen.')).toBeNull()
  })

  it('Talen renders as its own sub-tab (moved here, same LanguagesSection)', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Talen' }))
    expect(screen.getByText('Nog geen talen.')).toBeInTheDocument()
    // Switching away hides the previously-default Ervaring content.
    expect(screen.queryByText('Nog geen ervaringen.')).toBeNull()
  })

  it('Certificeringen renders on its own sub-tab', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Certificeringen' }))
    expect(screen.getByText('Nog geen certificeringen.')).toBeInTheDocument()
  })
})
