/**
 * ThemeContext — light/dark theme state.
 * Persists the choice in localStorage and applies it on mount; exposes the
 * current theme plus a setter/toggle to the app via useTheme().
 */
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import i18n from '../i18n'

interface ThemeValue {
  theme: string
  setTheme: (t: string) => void
  language: string
  setLanguage: (l: string) => void
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined)

// Holds the persisted theme/language pair and exposes it to the app via useTheme().
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,    setThemeState]    = useState(() => localStorage.getItem('km-theme')    || 'light')
  const [language, setLanguageState] = useState(() => localStorage.getItem('km-language') || 'nl')

  // Updates the theme in state and persists it so a reload keeps the user's choice.
  const setTheme = (t: string) => {
    setThemeState(t)
    localStorage.setItem('km-theme', t)
  }

  // Updates the language in state, persists it, and switches i18next. Non-nl bundles
  // load lazily through the i18n backend: changeLanguage() awaits them before it
  // emits languageChanged, so no key ever flashes untranslated during the switch.
  const setLanguage = (l: string) => {
    setLanguageState(l)
    localStorage.setItem('km-language', l)
    void i18n.changeLanguage(l)
  }

  // Reflects the active theme onto the document root whenever it changes, since the
  // CSS token overrides (§4) key off this attribute.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, language, setLanguage }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Accessor hook for the theme/language context; throws outside a ThemeProvider so a
// missing wrapper fails loudly instead of silently returning undefined values.
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
