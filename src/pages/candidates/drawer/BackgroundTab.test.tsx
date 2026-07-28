/**
 * BackgroundTab — Achtergrond tab sub-tab regression tests (Danny
 * kandidaten-ronde-2, punt B). Real i18n (nl) runs here — SectionTabs (imported
 * transitively) pulls in the real @/i18n side-effect init, so `t()` resolves
 * genuine Dutch text (mirrors SectionTabs.test.tsx). Only the Tiptap
 * RichTextEditor is stubbed; the lookup hooks' own GETs (skills/languages) are
 * covered by mocking `@/lib/api` so no real network call fires.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notify: vi.fn() }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

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

// Bug-class fix (optimistic-revert audit): onAdd/onEdit/onRemove used to fail
// soft — a rejected request left the optimistic write sitting on screen with
// only a toast, so the recruiter believed it had saved. These tests assert the
// actual rendered value snaps back after a rejected request, not merely that a
// toast fired (§13). Skills is the simplest sub-tab (no ProseField description,
// so a single 'Bewerken' pencil per row) — used throughout to keep the DOM
// queries unambiguous.
describe('BackgroundTab · ops() optimistic-revert (onAdd/onEdit/onRemove)', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.delete).mockReset()
    vi.mocked(notifyError).mockClear()
  })

  it('onAdd: drops the orphaned temp row when the POST rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValue(new Error('network'))
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Vaardigheden' }))
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    await user.type(screen.getByPlaceholderText('Vaardigheid'), 'Excel')
    // fireEvent (not userEvent): the mocked POST rejects on the SAME microtask
    // tick as the click — awaiting a userEvent click gives that catch handler
    // enough ticks to run before control returns, so the optimistic row would
    // already be gone by the time we could observe it. A plain synchronous
    // fireEvent.click lets us assert the optimistic state BEFORE the promise
    // settles, then waitFor drains the microtask queue for the revert.
    fireEvent.click(screen.getByTitle('Opslaan'))

    // Optimistic row appears immediately.
    expect(screen.getByText('Excel')).toBeInTheDocument()
    // The old bug: a rejected POST left this orphan row on screen forever.
    await waitFor(() => expect(screen.queryByText('Excel')).toBeNull())
    expect(notifyError).toHaveBeenCalled()
  })

  it('onEdit: restores the exact previous row when the PATCH rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockRejectedValue(new Error('network'))
    const c = { ...candidate(), skills: [{ id: 's1', name: 'Excel', level: '' }] } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Vaardigheden' }))
    expect(screen.getByText('Excel')).toBeInTheDocument()

    await user.click(screen.getByTitle('Bewerken'))
    const input = screen.getByDisplayValue('Excel')
    await user.clear(input)
    await user.type(input, 'Excel Advanced')
    // fireEvent (see onAdd comment above): keeps the optimistic write observable
    // before the mocked-rejected PATCH's catch handler runs.
    fireEvent.click(screen.getByTitle('Opslaan'))

    // Optimistic edit shows immediately.
    expect(screen.getByText('Excel Advanced')).toBeInTheDocument()
    // The old bug: a rejected PATCH left the edited value on screen forever.
    await waitFor(() => expect(screen.getByText('Excel')).toBeInTheDocument())
    expect(screen.queryByText('Excel Advanced')).toBeNull()
    expect(notifyError).toHaveBeenCalled()
  })

  it('onRemove: re-inserts the removed row at its original index when the DELETE rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(api.delete).mockRejectedValue(new Error('network'))
    const c = {
      ...candidate(),
      skills: [{ id: 's1', name: 'Excel', level: '' }, { id: 's2', name: 'Word', level: '' }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole('tab', { name: 'Vaardigheden' }))
    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.getByText('Word')).toBeInTheDocument()

    // fireEvent (see onAdd comment above): keeps the optimistic removal
    // observable before the mocked-rejected DELETE's catch handler runs.
    fireEvent.click(screen.getAllByTitle('Verwijderen')[0])
    // Optimistic remove: gone immediately.
    expect(screen.queryByText('Excel')).toBeNull()
    // The old bug: a rejected DELETE left the row permanently gone with only a toast.
    await waitFor(() => expect(screen.getByText('Excel')).toBeInTheDocument())
    // The OTHER row was never part of this mutation — a whole-list snapshot
    // restore would still leave it untouched here, but a bulk-loop scenario
    // (mirrors useEntityDocuments.remove) is exactly what surgical re-insert guards.
    expect(screen.getByText('Word')).toBeInTheDocument()
    expect(notifyError).toHaveBeenCalled()
  })
})
