/**
 * ThemeContext — light/dark theme state.
 * Persists the choice in localStorage and applies it on mount; exposes the
 * current theme plus a setter/toggle to the app via useTheme().
 */
import { createContext, useContext, useState, useEffect } from 'react'
import i18n from '../i18n'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme,    setThemeState]    = useState(() => localStorage.getItem('km-theme')    || 'light')
  const [language, setLanguageState] = useState(() => localStorage.getItem('km-language') || 'nl')

  const setTheme = (t) => {
    setThemeState(t)
    localStorage.setItem('km-theme', t)
  }

  const setLanguage = (l) => {
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

export const useTheme = () => useContext(ThemeContext)
