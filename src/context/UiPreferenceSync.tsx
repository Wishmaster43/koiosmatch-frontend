/**
 * UiPreferenceSync — render-less component that keeps theme and language
 * in sync with the user's server-side ui_preferences blob (X-16).
 *
 * Mounted inside AuthProvider. On login, applies server values if they differ
 * from the current local (ThemeContext) values. Whenever the local theme or
 * language changes, writes the new value back through useUserPreference.
 * Never writes while logged out.
 */
import { useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'
import { useUserPreference } from '@/hooks/useUserPreference'

export function UiPreferenceSync() {
  const auth = useAuth()
  const { theme, setTheme, language, setLanguage } = useTheme()
  const [serverTheme, setServerTheme] = useUserPreference<string | null>('ui_theme', null)
  const [serverLanguage, setServerLanguage] = useUserPreference<string | null>('ui_language', null)

  // Guards against applying server values repeatedly; a server value is applied
  // once on login, then local changes drive writes, never the reverse.
  const appliedServerValuesRef = useRef(false)

  // On login, apply server values if they differ from local ones (server wins).
  useEffect(() => {
    if (!auth?.user) {
      appliedServerValuesRef.current = false
      return
    }

    if (!appliedServerValuesRef.current) {
      if (serverTheme && serverTheme !== theme) {
        setTheme(serverTheme)
      }
      if (serverLanguage && serverLanguage !== language) {
        setLanguage(serverLanguage)
      }
      appliedServerValuesRef.current = true
    }
  }, [auth, theme, serverTheme, language, serverLanguage, setTheme, setLanguage])

  // When local theme changes (not via login), write it to preferences.
  useEffect(() => {
    if (!auth?.user) return
    if (serverTheme === theme) return // Skip writes when unchanged.

    setServerTheme(theme)
  }, [auth, theme, serverTheme, setServerTheme])

  // When local language changes (not via login), write it to preferences.
  useEffect(() => {
    if (!auth?.user) return
    if (serverLanguage === language) return // Skip writes when unchanged.

    setServerLanguage(language)
  }, [auth, language, serverLanguage, setServerLanguage])

  return null
}
