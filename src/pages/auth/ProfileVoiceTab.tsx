/**
 * ProfileVoiceTab — VOICE-SETTINGS-1: per-user Koios voice settings (mic
 * on/off, dictation language, read-aloud on/off, picked local voice). Step 1
 * of the voice roadmap (Danny 29-09 "Jarvis Iron Man idee") — browser-local
 * only, no paid TTS/STT service yet. Only `localService === true` voices are
 * ever offered (§8: an answer must never be sent to a remote voice service).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/ThemeContext'
import { Section, Field } from './profileParts'
import Toggle from '@/components/ui/Toggle'
import Button from '@/components/ui/Button'
import { SelectField } from '@/components/forms/fields'
import { Caption } from '@/components/ui/typography'
import { useKoiosVoicePreference, resolveDictationLang, localVoicesFor } from '@/hooks/useKoiosVoicePreference'
import type { KoiosVoiceLanguage } from '@/hooks/useKoiosVoicePreference'
import { isDictationSupported } from '@/components/layout/koios/koiosSpeechSupport'
import { useSpeechSynthesis, toSpeakableText } from '@/components/layout/koios/useSpeechSynthesis'

const DICTATION_LANGUAGES: KoiosVoiceLanguage[] = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']

// The "Spraak" (Voice) profile tab: four settings rows inside one Section.
export default function ProfileVoiceTab() {
  const { t } = useTranslation('auth')
  const { language: uiLanguage } = useTheme()
  const [pref, patch] = useKoiosVoicePreference()
  const synth = useSpeechSynthesis()

  // Local voice list — loaded asynchronously in Chrome, so an effect re-reads it
  // once `onvoiceschanged` fires (REFS-IN-EFFECTS-1: all state writes stay inside the effect).
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const read = () => setVoices(window.speechSynthesis.getVoices())
    read()
    window.speechSynthesis.onvoiceschanged = read
    // Guarded: the API can disappear before cleanup (e.g. test teardown order).
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null }
  }, [])

  const resolvedLang = resolveDictationLang(pref, uiLanguage)
  const localVoices = localVoicesFor(voices, resolvedLang)
  const dictationDisabled = !isDictationSupported() || window.isSecureContext === false

  return (
    <Section title={t('profile.voice.title')}>
      <Caption as="p" style={{ marginTop: -10, marginBottom: 18 }}>
        {t('profile.voice.subtitle')}
      </Caption>

      {/* Speech input (mic) on/off */}
      <Field label={t('profile.voice.input.label')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle checked={pref.input} disabled={dictationDisabled}
            onChange={v => patch({ input: v })} ariaLabel={t('profile.voice.input.label')} />
          <Caption as="span">{dictationDisabled ? t('profile.voice.input.unsupported') : t('profile.voice.input.desc')}</Caption>
        </div>
      </Field>

      {/* Dictation language: 'auto' follows the app language, or an explicit pick */}
      <Field label={t('profile.voice.language.label')} htmlFor="koios-voice-language">
        {/* DROPDOWN-CLEAR-1: a required single choice that persists on pick; "auto" is the empty state */}
        <SelectField
          id="koios-voice-language"
          value={pref.language}
          onChange={v => patch({ language: v as KoiosVoiceLanguage })}
          clearable={false}
          options={[
            { value: 'auto', label: t('profile.voice.language.auto') },
            ...DICTATION_LANGUAGES.map(code => ({ value: code, label: t(`languageNames.${code}`) })),
          ]}
        />
        <Caption as="p" style={{ marginTop: 6 }}>{t('profile.voice.language.desc')}</Caption>
      </Field>

      {/* Read aloud: Koios speaks its answers without the full hands-free conversation mode */}
      <Field label={t('profile.voice.readAloud.label')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle checked={pref.readAloud} disabled={!synth.supported}
            onChange={v => patch({ readAloud: v })} ariaLabel={t('profile.voice.readAloud.label')} />
          <Caption as="span">{synth.supported ? t('profile.voice.readAloud.desc') : t('profile.voice.readAloud.unsupported')}</Caption>
        </div>
      </Field>

      {/* Which local voice reads the answers aloud — the picker only renders once the
          local voice list has arrived; an empty picker that still opens is a fake affordance (§3) */}
      <Field label={t('profile.voice.voice.label')} htmlFor="koios-voice-name">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {localVoices.length > 0 && (
            <SelectField
              id="koios-voice-name"
              value={pref.voiceName ?? ''}
              onChange={v => patch({ voiceName: v || null })}
              clearable
              options={localVoices.map(v => ({ value: v.name, label: v.name }))}
            />
          )}
          <Button variant="secondary" size="sm" disabled={synth.speaking || localVoices.length === 0}
            onClick={() => synth.speak(toSpeakableText(t('profile.voice.testSentence')), resolvedLang, pref.voiceName)}>
            {t('profile.voice.test')}
          </Button>
        </div>
        <Caption as="p" style={{ marginTop: 6 }}>
          {localVoices.length === 0 ? t('profile.voice.voice.noneLocal') : t('profile.voice.voice.desc')}
        </Caption>
        <Caption as="p" style={{ marginTop: 2 }}>{t('profile.voice.voice.localOnly')}</Caption>
      </Field>
    </Section>
  )
}
