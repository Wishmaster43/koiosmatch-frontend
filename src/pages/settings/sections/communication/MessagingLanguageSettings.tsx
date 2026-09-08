/**
 * MessagingLanguageSettings — AVG-RET-2-TAAL-1: the agency-wide default
 * language for messages Koios sends to candidates/contacts with no preferred
 * language of their own. One tenant setting key, saved through the shared
 * `saveSettingsKeys` writer (mirrors KoiosModeDefaultCard's idiom):
 *   candidate_messaging_language_default  ISO code, backend default 'nl'
 * Gated on `settings.update`; a user without it sees the current value read-only.
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useMessagingLanguageOptions } from '@/lib/useMessagingLanguageOptions'
import { DEFAULT_MESSAGING_LANGUAGE } from '@/modules/messagingLanguages'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import { SectionTitle, Caption, BodyText } from '@/components/ui/typography'

type AnyProps = Record<string, unknown>
// CreatableSelect is still untyped JS — accept any props at the boundary.
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const DEFAULT_KEY = 'candidate_messaging_language_default'

// Agency-wide candidate/contact messaging-language default card.
export default function MessagingLanguageSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  const values = useAllSettings()
  const { options, labelFor } = useMessagingLanguageOptions()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The default always carries a value ('nl' when unset) — not a clearable field.
  const current = (values[DEFAULT_KEY] as string) || DEFAULT_MESSAGING_LANGUAGE

  // Persists the one key through the shared writer; the value reverts on failure.
  const save = async (code: string) => {
    setSaving(true); setError(null)
    try {
      await saveSettingsKeys({ [DEFAULT_KEY]: code })
    } catch (err) {
      const msg = extractApiError(err, t('messagingLanguage.saveFailed'), { [DEFAULT_KEY]: t('messagingLanguage.label') })
      setError(msg)
      notifyError(msg)
    }
    setSaving(false)
  }

  return (
    <div style={card}>
      <SectionTitle>{t('messagingLanguage.title')}</SectionTitle>
      <Caption style={{ display: 'block', margin: '4px 0 12px' }}>{t('messagingLanguage.subtitle')}</Caption>

      {canEdit ? (
        // DROPDOWN-CLEAR-1: language is a required setting with no empty state.
        <CreatableSelect value={current} onChange={(v: string) => !saving && save(v)} allowCreate={false}
          clearable={false} placeholder={t('messagingLanguage.label')} options={options} style={{ maxWidth: 320 }} />
      ) : (
        <BodyText>{labelFor(current)}</BodyText>
      )}

      {error && <Caption style={{ display: 'block', marginTop: 6, color: 'var(--color-danger-text)' }}>{error}</Caption>}
    </div>
  )
}
