/**
 * KoiosModelsCard — KOIOS-MODEL-UI-1 (Danny 23-08, screenshot: "hoe kan ik nu
 * zien welk model er gekoppeld is? ... de klant kan alleen kiezen VAN het
 * model"): the active tier must be unmistakable (check mark + aria-checked),
 * and the raw vendor model id must stay platform-only (super admin only),
 * never a tenant-visible fact. §13: mutation test asserts the REQUEST body.
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
const t = (key) => key

const models = {
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
  it('shows the raw model id to a super admin', () => {
    mockUseAuth.mockReturnValue({ isSuperAdmin: () => true })
    render(<KoiosModelsCard models={models} t={t} />)
    expect(screen.getByText('claude-sonnet-5')).toBeInTheDocument()
    expect(screen.getByText('claude-haiku-4-5')).toBeInTheDocument()
    expect(screen.getByText('claude-opus-4-8')).toBeInTheDocument()
  })

  // (d) the display-only hiding must never touch the API contract: picking a tier
  // still PUTs the exact raw model value.
  it('still PUTs the raw model value when picking another flavour', async () => {
    mockUpdateKoiosModel.mockResolvedValue({})
    const onChanged = vi.fn()
    render(<KoiosModelsCard models={models} t={t} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('radio', { name: /models\.tier\.max/ }))
    await waitFor(() => expect(mockUpdateKoiosModel).toHaveBeenCalledWith('claude-opus-4-8'))
    expect(onChanged).toHaveBeenCalledWith('claude-opus-4-8')
  })
})
