/**
 * KoiosModeDefaultCard — KOIOS-MODE-DEFAULT (Danny 02-09, "B. Ja"): the
 * bureau-wide Wizard/Auto default every user inherits until they choose for
 * themselves. Two tenant settings keys, saved through the shared
 * `saveSettingsKeys` writer (never a second POST /settings idiom):
 *   koios.mode_default          'wizard' | 'auto'
 *   koios.auto_messages_default '1' | '0' (server stores it in that form,
 *                                same as the per-user key — see the backend
 *                                contract in CLAUDE.md's slice notes)
 * Gated on `settings.update`; a user without it sees the current values but a
 * disabled control with an honest reason (§0 no fake affordances).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Toggle from '@/components/ui/Toggle'
import { SectionTitle, Caption, BodyText } from '@/components/ui/typography'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const MODE_KEY = 'koios.mode_default'
const AUTO_MESSAGES_KEY = 'koios.auto_messages_default'

// Reads the tenant boolean default the same way the backend stores it ('1'/'0'), unlike getBoolSetting's 'true' convention used elsewhere.
function readAutoMessagesDefault(raw: unknown): boolean {
  return raw === '1' || raw === true || raw === 'true'
}

// Bureau-wide Koios Wizard/Auto default card — first (status/models) settings tab, per the slice spec.
export default function KoiosModeDefaultCard() {
  const { t } = useTranslation('koios')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  const values = useAllSettings()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mode = values[MODE_KEY] === 'auto' ? 'auto' : 'wizard'
  const autoMessages = readAutoMessagesDefault(values[AUTO_MESSAGES_KEY])

  // Persists one key through the shared writer (booleans travel as the backend's own
  // '1'/'0' convention so the wire equals the read-back); the writer reverts on failure.
  const save = async (key: string, value: string | boolean) => {
    setSaving(key); setError(null)
    try {
      await saveSettingsKeys({ [key]: typeof value === 'boolean' ? (value ? '1' : '0') : value })
    } catch (err) {
      const msg = extractApiError(err, t('modeDefault.saveError'), { [key]: t('modeDefault.title') })
      setError(msg)
      notifyError(msg)
    }
    setSaving(null)
  }

  return (
    <div style={card}>
      <SectionTitle>{t('modeDefault.title')}</SectionTitle>
      <Caption style={{ display: 'block', margin: '4px 0 12px' }}>{t('modeDefault.desc')}</Caption>

      <div style={{ marginBottom: 14 }}>
        {canEdit ? (
          // The chooser only renders for who may write (§3: never a control that swallows
          // its click); a save in flight is not re-fired by a fast second click.
          <SegmentedControl
            ariaLabel={t('modeDefault.title')}
            options={[
              { value: 'wizard', label: t('modeDefault.wizard') },
              { value: 'auto', label: t('modeDefault.auto') },
            ]}
            value={mode}
            onChange={(v) => saving !== MODE_KEY && save(MODE_KEY, v)}
            activeOnly
            commitOnFocus={false}
          />
        ) : (
          <>
            <BodyText>{t(`modeDefault.${mode}`)}</BodyText>
            <Caption style={{ display: 'block', marginTop: 6 }}>{t('modeDefault.noPermission')}</Caption>
          </>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: canEdit ? 1 : 0.6 }}>
        <Toggle
          checked={autoMessages}
          onChange={(v) => save(AUTO_MESSAGES_KEY, v)}
          disabled={!canEdit || saving === AUTO_MESSAGES_KEY}
          ariaLabel={t('modeDefault.autoMessages')}
        />
        <Caption>{t('modeDefault.autoMessages')}</Caption>
      </label>

      <Caption style={{ display: 'block', marginTop: 10 }}>{t('modeDefault.deviationHint')}</Caption>
      {error && <Caption style={{ display: 'block', marginTop: 6, color: 'var(--color-danger-text)' }}>{error}</Caption>}
    </div>
  )
}
