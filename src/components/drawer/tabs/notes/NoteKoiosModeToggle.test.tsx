/**
 * NoteKoiosModeToggle — §13: proves it renders off the SAME useMyKoiosMode
 * hook the profile "Weergave" tab uses (never a forked copy) and that a click
 * PUTs the mode via that hook's own save path.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteKoiosModeToggle from './NoteKoiosModeToggle'
import api from '@/lib/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

afterEach(() => vi.clearAllMocks())

describe('NoteKoiosModeToggle', () => {
  it('renders nothing until the mode has loaded (no flash of the wrong state)', () => {
    vi.mocked(api.get).mockResolvedValue(new Promise(() => {})) // never resolves
    const { container } = render(<NoteKoiosModeToggle />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows Wizard active by default, Auto reachable', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { mode: 'wizard', auto_messages: false } })
    render(<NoteKoiosModeToggle />)
    const wizardBtn = await screen.findByRole('button', { name: 'Wizard' })
    expect(wizardBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking Auto PUTs /settings/my-koios-mode via the SAME shared hook used by the profile tab', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { mode: 'wizard', auto_messages: false } })
    vi.mocked(api.put).mockResolvedValue({ data: { mode: 'auto', auto_messages: false } })
    const user = userEvent.setup()
    render(<NoteKoiosModeToggle />)
    await screen.findByRole('button', { name: 'Wizard' })

    await user.click(screen.getByRole('button', { name: 'Auto' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-koios-mode', { mode: 'auto', auto_messages: false }))
  })
})
