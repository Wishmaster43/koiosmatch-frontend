/**
 * ProfileDisplayTab — regression test for the language-picker fix (audit
 * 2026-07-28): the five language names were hardcoded literals bypassing i18n
 * entirely. Fixed deliberately as AUTONYMS (each language names itself, e.g.
 * "Nederlands" for Dutch — the standard convention for a language switcher) but
 * routed through t('languageNames.<code>') so the string has one source of
 * truth per locale file instead of being embedded in the component.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileDisplayTab from './ProfileDisplayTab'

// A minimal stand-in translator that resolves languageNames.* the way the real
// nl/en/de/fr/es auth.json files do — proves the label comes from t(), not a
// literal in the component.
const LANGUAGE_NAMES: Record<string, string> = { nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español' }
vi.mock('react-i18next', () => ({
  // A real (unmocked) module import chain touches src/i18n/index.ts, which calls
  // i18n.use(initReactI18next) — provide a harmless 3rd-party stub so that doesn't throw.
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) => key.startsWith('languageNames.') ? LANGUAGE_NAMES[key.split('.')[1]] : key,
  }),
}))

describe('ProfileDisplayTab · language picker', () => {
  it('renders every language autonym via t(), never a hardcoded label', async () => {
    const user = userEvent.setup()
    render(<ProfileDisplayTab form={{ firstname: '', lastname: '', email: '', phone: '' }} setForm={vi.fn()}
      theme="light" setTheme={vi.fn()} language="en" setLanguage={vi.fn()} />)

    // Closed state shows the current language's autonym next to its flag.
    expect(screen.getByText(/English/)).toBeInTheDocument()

    // Opening the list shows every configured language by its own autonym.
    await user.click(screen.getByText(/English/))
    for (const name of Object.values(LANGUAGE_NAMES)) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })
})
