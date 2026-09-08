/**
 * KoiosEffortDefaultCard — X-8: tenant-configurable default Koios AI effort level
 * (low, medium, high, xhigh, max). Saved through the shared `saveSettingsKeys`
 * writer (single key `koios_default_effort`). The backend validates the choice
 * against the tenant's package ceiling and returns 422 with a message when above.
 * Gated on `settings.update` (§0 no fake affordances: a user without permission
 * sees the stored value disabled + reason).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import SearchSelect from '@/components/ui/SearchSelect'
import { SectionTitle, Caption, BodyText } from '@/components/ui/typography'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const EFFORT_KEY = 'koios_default_effort'
const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']

// Tenant default Koios effort level picker — saves through the shared writer.
export default function KoiosEffortDefaultCard() {
  const { t } = useTranslation('koios')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  const values = useAllSettings()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effort = String(values[EFFORT_KEY] ?? 'high')

  // Persists the effort level through the shared writer; on 422 shows the server message inline.
  const save = async (value: string) => {
    setSaving(EFFORT_KEY); setError(null)
    try {
      await saveSettingsKeys({ [EFFORT_KEY]: value })
    } catch (err) {
      const msg = extractApiError(err, t('effortDefault.saveError'), { [EFFORT_KEY]: t('effortDefault.title') as string })
      setError(msg)
      notifyError(msg)
    }
    setSaving(null)
  }

  const options = EFFORT_LEVELS.map(level => ({ value: level, label: t(`effort.${level}`) as string }))
  const current = options.find(o => o.value === effort)

  return (
    <div style={card}>
      <SectionTitle>{t('effortDefault.title') as string}</SectionTitle>
      <Caption style={{ display: 'block', margin: '4px 0 12px' }}>{t('effortDefault.hint') as string}</Caption>

      <div style={{ marginBottom: 14 }}>
        {canEdit ? (
          // The searchable dropdown (its own field face, no custom trigger) renders only for who
          // may write (§3 no fake affordances); a save in flight is not re-fired by a second click.
          // DROPDOWN-CLEAR-1: effort is a required setting with no default-on-clear logic.
          <SearchSelect
            closeOnToggle
            clearable={false}
            triggerLabel={current?.label ?? effort}
            aria-label={t('effortDefault.title') as string}
            options={options}
            selected={[effort]}
            onToggle={(v) => saving !== EFFORT_KEY && save(v)}
            disabled={saving === EFFORT_KEY}
          />
        ) : (
          <>
            <BodyText>{current?.label ?? effort}</BodyText>
            <Caption style={{ display: 'block', marginTop: 6 }}>{t('effortDefault.noPermission') as string}</Caption>
          </>
        )}
      </div>

      {error && <div role="status" style={{ display: 'block', marginTop: 6, color: 'var(--color-danger-text)', fontSize: 12 }}>{error}</div>}
    </div>
  )
}
