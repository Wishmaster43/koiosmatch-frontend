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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,    setThemeState]    = useState(() => localStorage.getItem('km-theme')    || 'light')
  const [language, setLanguageState] = useState(() => localStorage.getItem('km-language') || 'nl')

  const setTheme = (t: string) => {
    setThemeState(t)
    localStorage.setItem('km-theme', t)
  }

  const setLanguage = (l: string) => {
    setLanguageState(l)
    localStorage.setItem('km-language', l)
    i18n.changeLanguage(l)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, language, setLanguage }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
