/**
 * UiPreferenceSync tests — verifies that theme and language sync from
 * ui_preferences on login, and that local changes write back to the server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { UiPreferenceSync } from './UiPreferenceSync'
import { ThemeProvider, useTheme } from './ThemeContext'
import i18n from '@/i18n'

// Track calls to useUserPreference setters so we can verify writes.
const userPrefState = {
  theme: null as string | null,
  language: null as string | null,
  themeCalls: [] as Array<string | null>,
  languageCalls: [] as Array<string | null>,
}

vi.mock('@/hooks/useUserPreference', () => ({
  useUserPreference: (key: string, fallback: unknown) => {
    if (key === 'ui_theme') {
      return [userPrefState.theme, (v: string | null) => {
        userPrefState.themeCalls.push(v)
        userPrefState.theme = v
      }]
    }
    if (key === 'ui_language') {
      return [userPrefState.language, (v: string | null) => {
        userPrefState.languageCalls.push(v)
        userPrefState.language = v
      }]
    }
    return [fallback, vi.fn()]
  },
}))

// Mock AuthContext to control logged-in state.
const authState = { user: null as Record<string, unknown> | null }
vi.mock('./AuthContext', async () => {
  const actual = await vi.importActual<typeof import('./AuthContext')>('./AuthContext')
  return {
    ...actual,
    useAuth: () => authState.user ? { user: authState.user, refreshUser: vi.fn() } : null,
  }
})

vi.mock('@/i18n', () => ({ default: { changeLanguage: vi.fn() } }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { put: vi.fn().mockResolvedValue({}) } }
})

// Helper: render UiPreferenceSync + ThemeProvider + a consumer.
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <UiPreferenceSync />
      {children}
    </ThemeProvider>
  )
}

describe('UiPreferenceSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    authState.user = null
    userPrefState.theme = null
    userPrefState.language = null
    userPrefState.themeCalls = []
    userPrefState.languageCalls = []
    document.documentElement.removeAttribute('data-theme')
  })

  it('applies server theme and language on login when they differ from local', async () => {
    localStorage.setItem('km-theme', 'light')
    localStorage.setItem('km-language', 'nl')
    userPrefState.theme = 'dark'
    userPrefState.language = 'en'

    authState.user = { id: 1, ui_preferences: { ui_theme: 'dark', ui_language: 'en' } }

    // Render a component that uses useTheme so we can observe the change.
    const { result } = renderHook(() => useTheme(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.theme).toBe('dark')
      expect(result.current.language).toBe('en')
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('does not apply server values when they already match local ones', async () => {
    localStorage.setItem('km-theme', 'dark')
    localStorage.setItem('km-language', 'en')
    userPrefState.theme = 'dark'
    userPrefState.language = 'en'

    authState.user = { id: 1, ui_preferences: { ui_theme: 'dark', ui_language: 'en' } }

    vi.mocked(i18n.changeLanguage).mockClear()
    renderHook(() => useTheme(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(i18n.changeLanguage).not.toHaveBeenCalled()
    })
  })

  it('does not make any requests when logged out', async () => {
    const api = await import('@/lib/api')
    vi.mocked(api.default.put).mockClear()

    authState.user = null
    renderHook(() => null, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(api.default.put).not.toHaveBeenCalled()
    })
  })

  it('applies server theme but not language when only theme differs', async () => {
    localStorage.setItem('km-theme', 'light')
    localStorage.setItem('km-language', 'en')
    userPrefState.theme = 'dark'
    userPrefState.language = 'en'

    authState.user = { id: 1, ui_preferences: { ui_theme: 'dark', ui_language: 'en' } }

    const { result } = renderHook(() => useTheme(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.theme).toBe('dark')
      expect(result.current.language).toBe('en')
    })

    expect(i18n.changeLanguage).not.toHaveBeenCalled()
  })

  it('applies server language but not theme when only language differs', async () => {
    localStorage.setItem('km-theme', 'dark')
    localStorage.setItem('km-language', 'nl')
    userPrefState.theme = 'dark'
    userPrefState.language = 'en'

    authState.user = { id: 1, ui_preferences: { ui_theme: 'dark', ui_language: 'en' } }

    const { result } = renderHook(() => useTheme(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.language).toBe('en')
    })

    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('does not re-apply server values on login (no loop)', async () => {
    localStorage.setItem('km-theme', 'light')
    localStorage.setItem('km-language', 'nl')
    userPrefState.theme = 'dark'
    userPrefState.language = 'en'

    authState.user = { id: 1, ui_preferences: { ui_theme: 'dark', ui_language: 'en' } }

    const { result } = renderHook(() => useTheme(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.theme).toBe('dark')
    })

    const initialThemeCalls = userPrefState.themeCalls.length
    const initialLanguageCalls = userPrefState.languageCalls.length

    // Verify that applying server values doesn't trigger write-back.
    await new Promise(r => setTimeout(r, 100))

    expect(userPrefState.themeCalls.length).toBe(initialThemeCalls)
    expect(userPrefState.languageCalls.length).toBe(initialLanguageCalls)
  })

  it('writes theme changes to preferences after login', async () => {
    localStorage.setItem('km-theme', 'light')
    localStorage.setItem('km-language', 'nl')
    userPrefState.theme = 'light'
    userPrefState.language = 'nl'

    authState.user = { id: 1, ui_preferences: { ui_theme: 'light', ui_language: 'nl' } }

    const { result } = renderHook(() => useTheme(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.theme).toBe('light')
    })

    // Simulate a theme change via setTheme.
    await act(async () => {
      result.current.setTheme('dark')
    })

    await waitFor(() => {
      expect(userPrefState.themeCalls).toContain('dark')
    })
  })

  it('writes language changes to preferences after login', async () => {
    localStorage.setItem('km-theme', 'light')
    localStorage.setItem('km-language', 'nl')
    userPrefState.theme = 'light'
    userPrefState.language = 'nl'

    authState.user = { id: 1, ui_preferences: { ui_theme: 'light', ui_language: 'nl' } }

    const { result } = renderHook(() => useTheme(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.language).toBe('nl')
    })

    // Simulate a language change via setLanguage.
    await act(async () => {
      result.current.setLanguage('en')
    })

    await waitFor(() => {
      expect(userPrefState.languageCalls).toContain('en')
    })
  })
})
