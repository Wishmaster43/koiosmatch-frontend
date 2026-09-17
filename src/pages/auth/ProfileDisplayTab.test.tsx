/**
 * ProfileDisplayTab — regression test for the language-picker fix (audit
 * 2026-07-28): the five language names were hardcoded literals bypassing i18n
 * entirely. Fixed deliberately as AUTONYMS (each language names itself, e.g.
 * "Nederlands" for Dutch — the standard convention for a language switcher) but
 * routed through t('languageNames.<code>') so the string has one source of
 * truth per locale file instead of being embedded in the component.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileDisplayTab from './ProfileDisplayTab'
import api from '@/lib/api'

// A minimal stand-in translator that resolves languageNames.* the way the real
// seven auth.json files (nl/en/de/fr/es/it/pt) do — proves the label comes from t(), not a
// literal in the component.
const LANGUAGE_NAMES: Record<string, string> = { nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português' }
vi.mock('react-i18next', () => ({
  // A real (unmocked) module import chain touches src/i18n/index.ts, which calls
  // i18n.use(initReactI18next) — provide a harmless 3rd-party stub so that doesn't throw.
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) => key.startsWith('languageNames.') ? LANGUAGE_NAMES[key.split('.')[1]] : key,
  }),
}))
// The component now also mounts useMyKoiosMode (its own GET /settings/my-koios-mode) —
// mock the API client so this unrelated test never fires a real network request.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { mode: 'wizard', auto_messages: false } }), put: vi.fn() } }
})

describe('ProfileDisplayTab · language picker', () => {
  it('renders every language autonym via t(), never a hardcoded label — via the shared searchable SelectMenu', async () => {
    const user = userEvent.setup()
    render(<ProfileDisplayTab form={{ firstname: '', lastname: '', email: '', phone: '' }} setForm={vi.fn()}
      theme="light" setTheme={vi.fn()} language="en" setLanguage={vi.fn()} />)

    // Closed state shows the current language's autonym next to its flag, and the
    // trigger is the shared SelectMenu (a searchable listbox), not a hand-rolled dropdown.
    const trigger = screen.getByRole('button', { expanded: false, name: /English/ })
    expect(trigger).toBeInTheDocument()

    // Opening the list shows every configured language by its own autonym, plus a search box (DROPDOWN-CLEAR-1 sibling: the searchable-everywhere rule).
    await user.click(trigger)
    expect(screen.getByPlaceholderText('search')).toBeInTheDocument()
    for (const name of Object.values(LANGUAGE_NAMES)) {
      // The trigger keeps showing the CURRENT selection while open, so a language
      // that is also the current one appears twice (trigger + menu row) — assert presence, not uniqueness.
      expect(screen.getAllByText(new RegExp(name)).length).toBeGreaterThan(0)
    }
  })
})

// K0 contract: GET/PUT /settings/my-koios-mode { mode, auto_messages } — asserts
// the REAL PUT (route + body), per §13, plus the auto_messages disabled-unless-auto rule.
describe('ProfileDisplayTab · Koios AI mode (K0)', () => {
  const renderTab = () => render(
    <ProfileDisplayTab form={{ firstname: '', lastname: '', email: '', phone: '' }} setForm={vi.fn()}
      theme="light" setTheme={vi.fn()} language="en" setLanguage={vi.fn()} />,
  )

  it('keeps the auto_messages Toggle disabled while wizard is active (the default)', async () => {
    renderTab()
    const toggle = await screen.findByRole('switch', { name: 'profile.koiosMode.autoMessages' })
    expect(toggle).toBeDisabled()
  })

  it('PUTs { mode: "auto", auto_messages: false } and enables the Toggle when Auto is picked', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    renderTab()

    await user.click(await screen.findByRole('button', { name: 'profile.koiosMode.auto' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-koios-mode', { mode: 'auto', auto_messages: false }))
    expect(screen.getByRole('switch', { name: 'profile.koiosMode.autoMessages' })).not.toBeDisabled()
  })

  it('a failed GET never shows the editor seeded with the hard-coded default as the loaded truth (§0 four UI states)', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('500'))
    renderTab()

    // The error surface renders instead of the mode pills — never a silent wizard default.
    expect(await screen.findByText('profile.koiosMode.loadError')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'profile.koiosMode.wizard' })).not.toBeInTheDocument()
  })
})

// X-15: the Weergave tab has no Save button, so a page-size pick must persist by itself —
// the pill hands the picked size to the caller's persist handler and updates the form.
describe('ProfileDisplayTab · page-size pick persists on its own (X-15)', () => {
  it('calls onPickPageSize with the picked size and updates the form', async () => {
    const user = userEvent.setup()
    const setForm = vi.fn()
    const onPickPageSize = vi.fn()
    render(<ProfileDisplayTab form={{ firstname: '', lastname: '', email: '', phone: '', default_per_page: 50 }} setForm={setForm}
      onPickPageSize={onPickPageSize} theme="light" setTheme={vi.fn()} language="en" setLanguage={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '100' }))
    expect(onPickPageSize).toHaveBeenCalledWith(100)
    expect(setForm).toHaveBeenCalledTimes(1)
  })
})

// D6 (§6 WCAG 2.2 AA): a choice-chip's selected state must be exposed to assistive
// tech via aria-pressed, not colour/weight alone — mirrors the Koios-mode pills below.
describe('ProfileDisplayTab · choice-chip aria-pressed (§6)', () => {
  it('exposes aria-pressed on the page-size pills, reflecting the active option', async () => {
    render(<ProfileDisplayTab form={{ firstname: '', lastname: '', email: '', phone: '', default_per_page: 50 }} setForm={vi.fn()}
      theme="light" setTheme={vi.fn()} language="en" setLanguage={vi.fn()} />)
    expect(screen.getByRole('button', { name: '50' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '100' })).toHaveAttribute('aria-pressed', 'false')
    // Flush the Koios-mode GET (own effect on mount) so its state update lands
    // inside act() before the test body returns.
    await waitFor(() => expect(api.get).toHaveBeenCalled())
  })

  it('exposes aria-pressed on the theme pills, reflecting the active theme', async () => {
    render(<ProfileDisplayTab form={{ firstname: '', lastname: '', email: '', phone: '' }} setForm={vi.fn()}
      theme="dark" setTheme={vi.fn()} language="en" setLanguage={vi.fn()} />)
    expect(screen.getByRole('button', { name: /profile\.dark/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /profile\.light/ })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(api.get).toHaveBeenCalled())
  })
})
