import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import KoiosMentionMenu from './KoiosMentionMenu'
import type { KoiosMentionMenuHandle } from './KoiosMentionMenu'
import api from '@/lib/api'

// t() echoes the key — every assertion below reads the labelKey/nav key, not Dutch copy.
const t = (k: string) => k

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

// Mutable auth stub (vi.hoisted so the mock factory below can close over it) —
// full access by default, overridden per-test for the visibility-gating case.
interface AuthStub { hasPermission: (p: string) => boolean }
const authState = vi.hoisted((): AuthStub => ({ hasPermission: () => true }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: authState.hasPermission }) }))

const noop = () => {}
const menuRef = createRef<HTMLDivElement>()

// KOIOS-MENTION-BREED-1: the default (no category chosen) "@" search fans out
// over every visible searchable category instead of candidates only.
describe('KoiosMentionMenu — default fan-out', () => {
  beforeEach(() => { mockGet.mockReset(); authState.hasPermission = () => true })

  it('issues one request per visible category with the typed query', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<KoiosMentionMenu query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    // 12 configured categories (koiosMentionCategories.ts) all have search wiring.
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(12))
    expect(mockGet).toHaveBeenCalledWith('/candidates', expect.objectContaining({ params: { search: 'ahmed', per_page: 5 } }))
    expect(mockGet).toHaveBeenCalledWith('/customer-locations', expect.objectContaining({ params: { q: 'ahmed', per_page: 5 } }))
  })

  it('renders a heading per category that has results, with the cap applied', async () => {
    // '/customers' is used by exactly ONE category (unlike '/candidates', shared
    // with 'leads') — keeps this assertion about ONE group's row count unambiguous.
    mockGet.mockImplementation((url: string) => url === '/customers'
      ? Promise.resolve({ data: { data: Array.from({ length: 8 }, (_, i) => ({ id: `k${i}`, name: `Klant ${i}` })) } })
      : Promise.resolve({ data: { data: [] } }))
    render(<KoiosMentionMenu query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    // Wait for the RESOLVED rows, not just the heading — the heading also
    // renders synchronously while still loading (its own honest loading state).
    await waitFor(() => expect(screen.getAllByText(/^Klant \d$/).length).toBeGreaterThan(0))
    expect(screen.getByText('nav.customers')).toBeInTheDocument()
    expect(screen.getAllByText(/^Klant \d$/)).toHaveLength(5) // RESULT_CAP
    // A category that resolved to zero hits never paints its own heading.
    await waitFor(() => expect(screen.queryByText('loading')).toBeNull())
    expect(screen.queryByText('nav.vacancies')).toBeNull()
  })

  it('a failing category does not sink the others, and shows its own honest error', async () => {
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.reject(new Error('boom'))
      : url === '/customers'
        ? Promise.resolve({ data: { data: [{ id: 'k1', name: 'Ziekenhuis A' }] } })
        : Promise.resolve({ data: { data: [] } }))
    render(<KoiosMentionMenu query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    await waitFor(() => expect(screen.getByText('Ziekenhuis A')).toBeInTheDocument())
    // A failing category keeps its own heading + an honest error notice — never
    // silently swallowed into "no results" (distinguishable from empty, §3).
    expect(screen.getByText('nav.vacancies')).toBeInTheDocument()
    expect(screen.getByText('koios.mention.searchError')).toBeInTheDocument()
    // A genuinely empty category (resolved [], never errored) stays hidden.
    expect(screen.queryByText('nav.tasks')).toBeNull()
  })

  it('retrying a failing fan-out category re-fires the whole batch', async () => {
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.reject(new Error('boom'))
      : Promise.resolve({ data: { data: [] } }))
    render(<KoiosMentionMenu query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    await waitFor(() => expect(screen.getByText('koios.mention.searchError')).toBeInTheDocument())
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.resolve({ data: { data: [{ id: 'v1', title: 'Verpleegkundige' }] } })
      : Promise.resolve({ data: { data: [] } }))
    await act(async () => { screen.getByRole('button', { name: 'error.retry' }).click() })
    await waitFor(() => expect(screen.getByText('Verpleegkundige')).toBeInTheDocument())
  })

  it('never fires a request for a category the user cannot see', async () => {
    authState.hasPermission = (p: string) => p !== 'vacancies.view'
    mockGet.mockResolvedValue({ data: { data: [] } })
    render(<KoiosMentionMenu query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/candidates', expect.anything()))
    expect(mockGet).not.toHaveBeenCalledWith('/vacancies', expect.anything())
  })

  it('never fires the fan-out below the 2-character threshold', () => {
    render(<KoiosMentionMenu query="a" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    // The category list may still show (1-char label matches), but the fan-out
    // itself must never call the API before the threshold.
    expect(mockGet).not.toHaveBeenCalled()
  })
})

// Manager decision (1) on the Opus rejection: a real roving listbox — a single
// highlighted index across EVERY group, driven imperatively by the composer
// (KoiosPanel forwards ArrowUp/ArrowDown/Enter to the handle below).
describe('KoiosMentionMenu — keyboard navigation (roving listbox)', () => {
  beforeEach(() => { mockGet.mockReset(); authState.hasPermission = () => true })

  it('renders role="listbox"/"option" and highlights the first row by default', async () => {
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.resolve({ data: { data: [{ id: 'v1', title: 'Verpleegkundige' }] } })
      : Promise.resolve({ data: { data: [] } }))
    render(<KoiosMentionMenu query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    await waitFor(() => expect(screen.getByText('Verpleegkundige')).toBeInTheDocument())
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('moveHighlight walks across a group boundary and pickHighlighted picks that row', async () => {
    const onPickEntity = vi.fn()
    // Two DIFFERENT single-hit groups, in MENTION_CATEGORIES order (vacancies
    // before customers) — the boundary between them is what's under test.
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.resolve({ data: { data: [{ id: 'v1', title: 'Verpleegkundige' }] } })
      : url === '/customers'
        ? Promise.resolve({ data: { data: [{ id: 'k1', name: 'Ziekenhuis A' }] } })
        : Promise.resolve({ data: { data: [] } }))
    const ref = createRef<KoiosMentionMenuHandle>()
    render(<KoiosMentionMenu ref={ref} query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={onPickEntity} t={t} menuRef={menuRef} />)
    await waitFor(() => expect(screen.getByText('Ziekenhuis A')).toBeInTheDocument())
    act(() => { ref.current!.moveHighlight(1) })
    const picked = ref.current!.pickHighlighted()
    expect(picked).toBe(true)
    expect(onPickEntity).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1' }), 'customers')
  })

  it('wraps from the first option back to the last on ArrowUp', async () => {
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.resolve({ data: { data: [{ id: 'v1', title: 'Verpleegkundige' }] } })
      : url === '/customers'
        ? Promise.resolve({ data: { data: [{ id: 'k1', name: 'Ziekenhuis A' }] } })
        : Promise.resolve({ data: { data: [] } }))
    const ref = createRef<KoiosMentionMenuHandle>()
    render(<KoiosMentionMenu ref={ref} query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    await waitFor(() => expect(screen.getByText('Ziekenhuis A')).toBeInTheDocument())
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    act(() => { ref.current!.moveHighlight(-1) })
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('reports the highlighted option id via onActiveOptionChange', async () => {
    const onActiveOptionChange = vi.fn()
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.resolve({ data: { data: [{ id: 'v1', title: 'Verpleegkundige' }] } })
      : Promise.resolve({ data: { data: [] } }))
    render(<KoiosMentionMenu query="ahmed" counts={{}} activeCategoryId={null} activeCategoryLabel={null}
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} onActiveOptionChange={onActiveOptionChange} />)
    await waitFor(() => expect(onActiveOptionChange).toHaveBeenCalledWith('koios-mention-option-vacancies-v1'))
  })

  it('pickHighlighted returns false when the menu has nothing to pick', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    const ref = createRef<KoiosMentionMenuHandle>()
    render(<KoiosMentionMenu ref={ref} query="Vacatures xyz" counts={{}} activeCategoryId="vacancies" activeCategoryLabel="Vacatures"
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    await waitFor(() => expect(screen.getByText('noResults')).toBeInTheDocument())
    expect(ref.current!.pickHighlighted()).toBe(false)
  })

  it('moveHighlight returns false when there is nothing to move to', () => {
    const ref = createRef<KoiosMentionMenuHandle>()
    render(<KoiosMentionMenu ref={ref} query="Vacatures xyz" counts={{}} activeCategoryId="vacancies" activeCategoryLabel="Vacatures"
      onPickCategory={noop} onPickEntity={noop} t={t} menuRef={menuRef} />)
    expect(ref.current!.moveHighlight(1)).toBe(false)
  })
})
