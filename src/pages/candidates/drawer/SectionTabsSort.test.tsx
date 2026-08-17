/**
 * Background sub-tab SORT CONTROL — regression tests for the shared
 * useRelationSort menu (Danny's "an icon with a submenu: start date, end date,
 * function, and my own order" request, 2026-08-17).
 *
 * Covers, per Requirement in the build brief:
 * - ONE menu (the shared ActionMenu), keyboard-reachable with a real accessible
 *   name — never a hand-rolled dropdown or a pair of buttons;
 * - each OFFERED option really reorders the rendered rows;
 * - an option is absent where the sub-tab has nothing real to sort by (Skills:
 *   no control at all; Education/Certifications: no function; References: no
 *   dates but a real `function` field);
 * - "own order" is never offered anywhere (no backend sort_order/reorder route
 *   exists yet for any of these five relations);
 * - the choice persists through the REAL /auth/me `ui_preferences` route — read
 *   once from the already-loaded user, written with the real merged body, and
 *   never lost locally when that write fails.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceTab, EducationTab, CertificationsTab, SkillsTab } from './SectionTabs'
import ReferencesTab from './ReferencesTab'

// Hoisted so these bindings exist before the (hoisted) vi.mock factories below
// run during module resolution — a plain `const` here would TDZ-error the
// first time `api.put`/`useAuth()` are actually invoked from inside a mock.
const { getMock, putMock, authState } = vi.hoisted(() => ({
  getMock: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  putMock: vi.fn(() => Promise.resolve({ data: {} })),
  authState: { user: null as { ui_preferences?: Record<string, unknown> } | null, refreshUser: vi.fn() },
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('@/lib/api', () => ({
  default: { get: getMock, put: putMock },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
  getActiveTenantId: () => 'test-tenant',
}))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/components/drawer/DocPreviewModal', () => ({ default: () => null }))
vi.mock('@/lib/downloadFiles', () => ({ downloadFilesSequentially: () => {} }))

beforeEach(() => {
  authState.user = null
  authState.refreshUser.mockClear()
  getMock.mockClear()
  putMock.mockClear()
  putMock.mockImplementation(() => Promise.resolve({ data: {} }))
})

// Open the sort menu, then pick the option with this exact label (mirrors how
// a recruiter actually drives the control — ActionMenu closes after each pick).
const pick = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('button', { name: 'Sorteren' }))
  await user.click(screen.getByRole('menuitem', { name: label }))
}

describe('ExperienceTab sort menu', () => {
  // start/end/function all move independently, so each axis proves it sorts by
  // ITS OWN field, not by coincidence with another one.
  const items = [
    { id: 'a', title: 'Verpleegkundige', company: 'Zorg B.V.', start: '2020-01-01', end: '2021-01-01' },
    { id: 'b', title: 'Arts',            company: 'Kliniek',   start: '2022-06-15', end: '2023-01-01' },
    { id: 'c', title: 'Coördinator',     company: 'Huis',      start: '2018-03-10', end: '2024-01-01' },
  ]
  const names = () => screen.getAllByText(/Verpleegkundige|Arts|Coördinator/).map(el => el.textContent)

  it('offers exactly start date, end date and function — all three are real columns here', async () => {
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Sorteren' }))
    expect(screen.getByRole('menu', { name: 'Sorteren' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Begindatum' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Einddatum' })).toBeInTheDocument()
    // FIELD TRAP (build brief point 3): the menu label is "Functietitel" — the FE
    // title field, which TO_API maps to the backend's `position` column (the job
    // title). It is never a stand-in for the future ordering column.
    expect(screen.getByRole('menuitem', { name: 'Functietitel' })).toBeInTheDocument()
  })

  // ACHTERGROND-DATUM-STANDAARD-1 (Danny 17-08: "standaard op datum dus laatste
  // werkervaring boven"). The list opens newest-first with nobody picking anything,
  // computed from the start dates the records already carry. No stored order and no
  // database column is involved; that is only needed for a manual override.
  it('opens newest-first on start date without any pick', () => {
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    expect(names()).toEqual(['Arts', 'Verpleegkundige', 'Coördinator'])
  })

  it('picking the start-date axis again flips to oldest-first', async () => {
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Begindatum')
    expect(names()).toEqual(['Coördinator', 'Verpleegkundige', 'Arts'])
  })

  it('end date (newest first on first pick) reorders the rows — a DIFFERENT order than start date', async () => {
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Einddatum')
    expect(names()).toEqual(['Coördinator', 'Arts', 'Verpleegkundige'])
  })

  it('function (A→Z on first pick) reorders the rows by the job title — reads `title`/`function_title`, never a position/order field', async () => {
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Functietitel')
    expect(names()).toEqual(['Arts', 'Coördinator', 'Verpleegkundige'])
  })

  // Cycling the axis off no longer lands on the raw order the server happened to
  // send. That order is insertion order: a user cannot explain it and never asked
  // for it, so offering it as a state would only confuse. Off returns to the
  // newest-first default instead.
  it('cycling the axis off returns to the newest-first default, not the raw received order', async () => {
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Begindatum') // asc
    await pick(user, 'Begindatum') // off -> back to the default
    expect(names()).toEqual(['Arts', 'Verpleegkundige', 'Coördinator'])
  })

  it('is keyboard-operable: Enter opens the menu on the focused trigger, Enter on the auto-focused first option picks it', async () => {
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    const trigger = screen.getByRole('button', { name: 'Sorteren' })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    // ActionMenu auto-focuses the first menu item on open (its own effect) — no
    // mouse ever touches this flow.
    await user.keyboard('{Enter}')
    // Start date is the first item and the list already opened on it descending,
    // so picking it flips to ascending.
    expect(names()).toEqual(['Coördinator', 'Verpleegkundige', 'Arts'])
  })
})

describe('EducationTab sort menu', () => {
  // Start EARLY/end LATE vs. start LATE/end EARLY — proves the two axes are
  // independent, not both reading the same underlying date.
  const items = [
    { id: 'e1', title: 'A-opleiding', start: '2010-01-01', end: '2023-01-01' },
    { id: 'e2', title: 'B-opleiding', start: '2015-01-01', end: '2016-01-01' },
  ]
  const names = () => screen.getAllByText(/A-opleiding|B-opleiding/).map(el => el.textContent)

  it('offers start date and end date but NOT function — candidate_educations has no job-title field', async () => {
    const user = userEvent.setup()
    render(<EducationTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Sorteren' }))
    expect(screen.getByRole('menuitem', { name: 'Begindatum' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Einddatum' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Functietitel' })).not.toBeInTheDocument()
  })

  it('start date and end date sort independently', async () => {
    const user = userEvent.setup()
    render(<EducationTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    // Already newest-start-first on open (ACHTERGROND-DATUM-STANDAARD-1), so no
    // pick is needed to see that axis; picking the OTHER axis proves independence.
    expect(names()).toEqual(['B-opleiding', 'A-opleiding']) // newer start first
    await pick(user, 'Einddatum')
    expect(names()).toEqual(['A-opleiding', 'B-opleiding']) // newer end first
  })
})

describe('CertificationsTab sort menu', () => {
  const items = [
    { id: 'c1', name: 'BHV', issued: '2020-01-01', expires: '2026-01-01' },
    { id: 'c2', name: 'VCA', issued: '2022-01-01', expires: '2024-01-01' },
  ]
  const names = () => screen.getAllByText(/BHV|VCA/).map(el => el.textContent)

  it('labels the two real date columns with THIS tab\'s own wording (Issued/Expires), not a generic Start/End', async () => {
    const user = userEvent.setup()
    render(<CertificationsTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Sorteren' }))
    expect(screen.getByRole('menuitem', { name: 'Uitgegeven' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Verloopt' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Functietitel' })).not.toBeInTheDocument()
  })

  it('Issued and Expires sort independently', async () => {
    const user = userEvent.setup()
    render(<CertificationsTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    // Newest issue date is already on top when the tab opens; picking the expiry
    // axis proves the two read different columns.
    expect(names()).toEqual(['VCA', 'BHV']) // newer issue date first
    await pick(user, 'Verloopt')
    expect(names()).toEqual(['BHV', 'VCA']) // newer expiry first
  })
})

describe('SkillsTab sort menu', () => {
  it('renders no sort control at all — candidate_skills has no date column and no function field', () => {
    render(<SkillsTab items={[{ id: '1', name: 'Triage', level: 'Expert' }]} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Sorteren' })).not.toBeInTheDocument()
  })

  it('never offers "own order" — no reorder route exists for candidate_skills', () => {
    render(<SkillsTab items={[{ id: '1', name: 'Triage' }]} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    expect(screen.queryByRole('button', { name: /drag|sleep|eigen volgorde/i })).not.toBeInTheDocument()
  })
})

describe('ReferencesTab sort menu', () => {
  const items = [
    { id: 'r1', first_name: 'Jan', last_name: 'Jansen', function: 'Teamleider' },
    { id: 'r2', first_name: 'Piet', last_name: 'Pietersen', function: 'Manager' },
  ]
  const names = () => screen.getAllByText(/Jan Jansen|Piet Pietersen/).map(el => el.textContent)

  it('offers ONLY function — candidate_references has no date column, but DOES carry the referent\'s own role', async () => {
    const user = userEvent.setup()
    render(<ReferencesTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onVerify={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Sorteren' }))
    expect(screen.getByRole('menuitem', { name: 'Functie' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Begindatum' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Einddatum' })).not.toBeInTheDocument()
  })

  it('function sort reorders references by the referent\'s own role', async () => {
    const user = userEvent.setup()
    render(<ReferencesTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} onVerify={() => {}} />)
    await pick(user, 'Functie')
    expect(names()).toEqual(['Piet Pietersen', 'Jan Jansen']) // Manager before Teamleider
  })
})

describe('Sort preference persistence (ui_preferences via PUT /auth/me)', () => {
  const items = [
    { id: 'a', title: 'Verpleegkundige', start: '2020-01-01' },
    { id: 'b', title: 'Arts', start: '2022-06-15' },
  ]
  const names = () => screen.getAllByText(/Verpleegkundige|Arts/).map(el => el.textContent)

  it('reads a previously saved sort back on mount, from the already-loaded user — no extra fetch', () => {
    authState.user = { ui_preferences: { candidate_background_sort: { experience: { field: 'function', dir: 'asc' } } } }
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    expect(names()).toEqual(['Arts', 'Verpleegkundige']) // A→Z by title, applied immediately
    expect(putMock).not.toHaveBeenCalled()
  })

  it('writes the picked sort to the real route with the real, MERGED body — another feature\'s ui_preferences key survives', async () => {
    authState.user = { ui_preferences: { some_other_feature: 'keep-me' } }
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Functietitel')
    await waitFor(() => expect(putMock).toHaveBeenCalledWith('/auth/me', {
      ui_preferences: {
        some_other_feature: 'keep-me',
        candidate_background_sort: { experience: { field: 'function', dir: 'asc' } },
      },
    }))
    expect(authState.refreshUser).toHaveBeenCalled()
  })

  it('keeps the chosen sort applied even when the background save fails — a preference write never costs the user their view', async () => {
    authState.user = { ui_preferences: {} }
    putMock.mockImplementation(() => Promise.reject(new Error('network')))
    const user = userEvent.setup()
    render(<ExperienceTab items={items} onAdd={() => {}} onEdit={() => {}} onRemove={() => {}} />)
    await pick(user, 'Functietitel')
    expect(names()).toEqual(['Arts', 'Verpleegkundige'])
    await waitFor(() => expect(putMock).toHaveBeenCalled())
    // The rejection has now resolved — the sort must still stand, not revert.
    expect(names()).toEqual(['Arts', 'Verpleegkundige'])
  })
})
