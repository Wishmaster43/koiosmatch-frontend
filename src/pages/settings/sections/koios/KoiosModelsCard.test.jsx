/**
 * KoiosModelsCard — KOIOS-MODEL-UI-1 (Danny 23-08, screenshot: "hoe kan ik nu
 * zien welk model er gekoppeld is? ... de klant kan alleen kiezen VAN het
 * model"): the active tier must be unmistakable (check mark + aria-checked),
 * and the raw vendor model id must stay platform-only (super admin only),
 * never a tenant-visible fact. §13: mutation test asserts the REQUEST body.
 * OL:KOIOS-MODEL-VOCAB-1: cost_note renders when present; costlier-model picker
 * shows a warning with confirm/cancel buttons.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import KoiosModelsCard from './KoiosModelsCard'

// The API call itself is mocked — no live /api/ai/koios/* call ever fires (API-CREDITS-1).
const mockUpdateKoiosModel = vi.fn()
vi.mock('./koiosApi', () => ({ updateKoiosModel: (...a) => mockUpdateKoiosModel(...a) }))

// mock-prefixed so Vitest allows access inside the hoisted vi.mock factory
// (mirrors CandidateDrawer.test.tsx's mockUseAuth) — toggled per test below.
const mockUseAuth = vi.fn(() => ({ isSuperAdmin: () => false }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

// t stub returns the raw key so assertions read exactly what the component asked for.
const t = (key, opts) => {
  if (opts?.model) return `${key} model=${opts.model}`
  return key
}

// The measured controller serves FLAVOUR KEYS in selectable[] (KOIOS-MODEL-
// VOCAB-1); the legacy raw-vendor-id fallback keeps its own dedicated test below.
const models = {
  active: 'slim',
  selectable: ['snel', 'slim', 'max'],
  options: [
    { id: 'snel', label: 'Snel', hint: 'Snelst', cost_rank: 1 },
    { id: 'slim', label: 'Slim', hint: 'Gebalanceerd', cost_rank: 2 },
    { id: 'max', label: 'Max', hint: 'Krachtigst', cost_rank: 3 },
  ],
}
const modelsWithCostNote = {
  ...models,
  cost_note: 'Kosten per token gelden volgens het tariefdocument.',
}
const legacyModels = {
  active: 'claude-sonnet-5',
  selectable: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'],
}

beforeEach(() => {
  mockUpdateKoiosModel.mockReset()
  mockUseAuth.mockReturnValue({ isSuperAdmin: () => false })
})

describe('KoiosModelsCard', () => {
  // (a) the active flavour must be unmistakable: aria-checked=true AND a visible
  // check mark (lucide's Check renders class "lucide-check"), inactive cards carry neither.
  it('marks the active flavour with aria-checked and a visible check mark', () => {
    render(<KoiosModelsCard models={models} t={t} />)
    const activeRadio = screen.getByRole('radio', { name: /models.tier.smart/ })
    expect(activeRadio).toHaveAttribute('aria-checked', 'true')
    expect(activeRadio.querySelector('svg.lucide-check')).not.toBeNull()

    const inactiveRadio = screen.getByRole('radio', { name: /models.tier.fast/ })
    expect(inactiveRadio).toHaveAttribute('aria-checked', 'false')
    expect(inactiveRadio.querySelector('svg.lucide-check')).toBeNull()
  })

  // (b) a normal tenant user never sees the raw vendor model id anywhere on the card.
  // Opus F2: active ∉ selectable (a config-invariant slip) must render an honest
  // notice — never three unmarked radios, which is Danny's original complaint.
  it('renders an honest notice when the active flavour is not in the selectable set', () => {
    render(<KoiosModelsCard models={{ active: 'claude-legacy-1', selectable: models.selectable }} t={t} />)
    expect(screen.getByRole('status')).toHaveTextContent('models.activeUnknown')
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('renders no notice when the active flavour is selectable', () => {
    render(<KoiosModelsCard models={models} t={t} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('hides the raw model id from a normal (non-super-admin) user', () => {
    render(<KoiosModelsCard models={models} t={t} />)
    expect(screen.queryByText(/claude-sonnet-5/)).not.toBeInTheDocument()
    expect(screen.queryByText(/claude-haiku-4-5/)).not.toBeInTheDocument()
    expect(screen.queryByText(/claude-opus-4-8/)).not.toBeInTheDocument()
  })

  // (c) Danny's own question ("hoe kan ik zien welk model gekoppeld is") — a super
  // admin still sees every raw id, rendered in Mono.
  it('shows the raw model id to a super admin (legacy vendor-id contract)', () => {
    mockUseAuth.mockReturnValue({ isSuperAdmin: () => true })
    render(<KoiosModelsCard models={legacyModels} t={t} />)
    expect(screen.getByText('claude-sonnet-5')).toBeInTheDocument()
    expect(screen.getByText('claude-haiku-4-5')).toBeInTheDocument()
    expect(screen.getByText('claude-opus-4-8')).toBeInTheDocument()
  })

  // (d) the display-only hiding must never touch the API contract: picking a tier
  // still PUTs the exact raw model value.
  it('still PUTs the exact listed value when picking another flavour (legacy vendor-id contract)', async () => {
    mockUpdateKoiosModel.mockResolvedValue({})
    const onChanged = vi.fn()
    render(<KoiosModelsCard models={legacyModels} t={t} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('radio', { name: /models\.tier\.max/ }))
    await waitFor(() => expect(mockUpdateKoiosModel).toHaveBeenCalledWith('claude-opus-4-8'))
    expect(onChanged).toHaveBeenCalledWith('claude-opus-4-8')
  })

  // KOIOS-MODEL-VOCAB-1 SEAM TEST (27-08): the CURRENT contract serves
  // `selectable[]`/`options[]` as FLAVOUR KEYS (snel/slim/max), not raw vendor
  // ids — proves the cost_rank -> icon mapping (iconForRank) actually reads the
  // server `options` prop: rank 1 -> Zap, the highest listed rank -> Crown,
  // anything between -> Sparkles.
  it('maps flavour-key selectable + server options to icons by cost_rank', () => {
    const flavourModels = {
      active: 'slim',
      selectable: ['snel', 'slim', 'max'],
      options: [
        { id: 'snel', label: 'Snel', hint: 'Snelst', cost_rank: 1 },
        { id: 'slim', label: 'Slim', hint: 'Gebalanceerd', cost_rank: 2 },
        { id: 'max', label: 'Max', hint: 'Krachtigst', cost_rank: 3 },
      ],
    }
    render(<KoiosModelsCard models={flavourModels} t={t} />)
    const fast = screen.getByRole('radio', { name: /models\.tier\.fast/ })
    const smart = screen.getByRole('radio', { name: /models\.tier\.smart/ })
    const max = screen.getByRole('radio', { name: /models\.tier\.max/ })
    expect(fast.querySelector('svg.lucide-zap')).not.toBeNull()
    expect(smart.querySelector('svg.lucide-sparkles')).not.toBeNull()
    expect(max.querySelector('svg.lucide-crown')).not.toBeNull()
    // The translated tier KEY (via the t() stub) wins over the server's Dutch
    // platform label ("Snel") for a known flavour (§5).
    expect(screen.queryByText('Snel')).not.toBeInTheDocument()
  })

  // OL:KOIOS-MODEL-VOCAB-1: cost_note renders when non-empty; absent when missing or null.
  it('renders cost_note when present', () => {
    render(<KoiosModelsCard models={modelsWithCostNote} t={t} />)
    expect(screen.getByText('Kosten per token gelden volgens het tariefdocument.')).toBeInTheDocument()
  })

  it('renders no cost_note when absent', () => {
    render(<KoiosModelsCard models={models} t={t} />)
    expect(screen.queryByText(/kosten per token/)).not.toBeInTheDocument()
  })

  // OL:KOIOS-MODEL-VOCAB-1: picking a costlier model shows a warning + confirm/cancel,
  // and does NOT call the update until confirmed.
  it('shows a costlier-model warning when picking a more expensive model', () => {
    render(<KoiosModelsCard models={models} t={t} />)
    // Pick max (cost_rank 3) while active is slim (cost_rank 2).
    fireEvent.click(screen.getByRole('radio', { name: /models\.tier\.max/ }))
    // The warning appears with the model label (resolved via t()).
    expect(screen.getByRole('status')).toHaveTextContent(/models\.costlierWarning.*model=models\.tier\.max/)
    // The update has NOT been called yet.
    expect(mockUpdateKoiosModel).not.toHaveBeenCalled()
  })

  it('calls the update when confirming the costlier-model pick', async () => {
    mockUpdateKoiosModel.mockResolvedValue({})
    const onChanged = vi.fn()
    render(<KoiosModelsCard models={models} t={t} onChanged={onChanged} />)
    // Pick max (cost_rank 3).
    fireEvent.click(screen.getByRole('radio', { name: /models\.tier\.max/ }))
    // Confirm the warning.
    fireEvent.click(screen.getByRole('button', { name: 'models.costlierConfirm' }))
    // The update is called with the model id.
    await waitFor(() => expect(mockUpdateKoiosModel).toHaveBeenCalledWith('max'))
    expect(onChanged).toHaveBeenCalledWith('max')
  })

  it('clears the warning when canceling the costlier-model pick', () => {
    render(<KoiosModelsCard models={models} t={t} />)
    // Pick max.
    fireEvent.click(screen.getByRole('radio', { name: /models\.tier\.max/ }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    // Cancel the warning.
    fireEvent.click(screen.getByRole('button', { name: 'common:cancel' }))
    // The warning is gone, the picker reverts to the active selection.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(mockUpdateKoiosModel).not.toHaveBeenCalled()
  })

  it('calls the update immediately when picking a cheaper or equal-cost model', async () => {
    mockUpdateKoiosModel.mockResolvedValue({})
    const onChanged = vi.fn()
    render(<KoiosModelsCard models={models} t={t} onChanged={onChanged} />)
    // Pick snel (cost_rank 1) while active is slim (cost_rank 2) — cheaper.
    fireEvent.click(screen.getByRole('radio', { name: /models\.tier\.fast/ }))
    // No warning appears; the update is called immediately.
    expect(screen.queryByRole('status', { name: /costlier/ })).not.toBeInTheDocument()
    await waitFor(() => expect(mockUpdateKoiosModel).toHaveBeenCalledWith('snel'))
    expect(onChanged).toHaveBeenCalledWith('snel')
  })
})
