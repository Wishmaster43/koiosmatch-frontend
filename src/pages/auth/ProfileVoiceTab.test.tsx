/**
 * ProfileVoiceTab — VOICE-SETTINGS-1: the four settings rows (input toggle,
 * dictation language, read-aloud toggle, voice picker + Test button), the
 * honest unsupported/no-local-voice states, and the preference writes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileVoiceTab from './ProfileVoiceTab'
import api from '@/lib/api'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue ?? key) }),
}))
vi.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ language: 'en', theme: 'light', setTheme: vi.fn(), setLanguage: vi.fn() }) }))

const authUser = vi.hoisted(() => ({ ui_preferences: null as Record<string, unknown> | null }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { ui_preferences: authUser.ui_preferences }, refreshUser: vi.fn() }),
}))
vi.mock('@/lib/api', () => ({ default: { put: vi.fn().mockResolvedValue({}) } }))

// Web Speech API stubs — jsdom ships neither constructor by default.
function stubDictationSupport() { (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class {} }
function clearDictationSupport() { delete (window as { SpeechRecognition?: unknown }).SpeechRecognition }
function stubSynthesis(voices: SpeechSynthesisVoice[] = []) {
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    getVoices: () => voices, onvoiceschanged: null, speak: vi.fn(), cancel: vi.fn(),
  }
  ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    constructor(public text: string) {}
  }
}
function clearSynthesis() {
  delete (window as { speechSynthesis?: unknown }).speechSynthesis
  delete (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance
}

describe('ProfileVoiceTab', () => {
  beforeEach(() => { authUser.ui_preferences = null })
  afterEach(() => { clearDictationSupport(); clearSynthesis() })

  it('renders an honest unsupported state when the browser has no dictation API', () => {
    clearDictationSupport()
    stubSynthesis()
    render(<ProfileVoiceTab />)
    const toggle = screen.getByRole('switch', { name: 'profile.voice.input.label' })
    expect(toggle).toBeDisabled()
    expect(screen.getByText('profile.voice.input.unsupported')).toBeInTheDocument()
  })

  it('renders an honest unsupported state when speechSynthesis is missing', () => {
    stubDictationSupport()
    clearSynthesis()
    render(<ProfileVoiceTab />)
    expect(screen.getByRole('switch', { name: 'profile.voice.readAloud.label' })).toBeDisabled()
    expect(screen.getByText('profile.voice.readAloud.unsupported')).toBeInTheDocument()
  })

  it('shows the "no local voice" caption and hides the picker when no local voice matches', () => {
    stubDictationSupport()
    stubSynthesis([{ name: 'Cloud Voice', lang: 'en-US', localService: false } as SpeechSynthesisVoice])
    render(<ProfileVoiceTab />)
    // No picker while the local voice list is empty — a fake affordance otherwise (§3).
    expect(screen.getAllByText('profile.voice.voice.noneLocal')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'profile.voice.voice.label' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'profile.voice.test' })).toBeDisabled()
  })

  it('gives both select pickers an accessible name', () => {
    stubDictationSupport()
    stubSynthesis([{ name: 'Google EN', lang: 'en-US', localService: true } as SpeechSynthesisVoice])
    render(<ProfileVoiceTab />)
    expect(screen.getByRole('button', { name: 'profile.voice.language.label' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'profile.voice.voice.label' })).toBeInTheDocument()
  })

  it('toggling speech input patches the preference and PUTs /auth/me', async () => {
    stubDictationSupport()
    stubSynthesis()
    const user = userEvent.setup()
    render(<ProfileVoiceTab />)
    await user.click(screen.getByRole('switch', { name: 'profile.voice.input.label' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/me', {
      ui_preferences: { koios_voice: { input: false, language: 'auto', readAloud: false, voiceName: null } },
    }))
  })

  it('the Test button speaks the test sentence through the currently picked voice', async () => {
    stubDictationSupport()
    stubSynthesis([{ name: 'Google EN', lang: 'en-US', localService: true } as SpeechSynthesisVoice])
    authUser.ui_preferences = { koios_voice: { input: true, language: 'auto', readAloud: false, voiceName: 'Google EN' } }
    const user = userEvent.setup()
    render(<ProfileVoiceTab />)
    const testButton = screen.getByRole('button', { name: 'profile.voice.test' })
    expect(testButton).not.toBeDisabled()
    await user.click(testButton)
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1)
  })
})
