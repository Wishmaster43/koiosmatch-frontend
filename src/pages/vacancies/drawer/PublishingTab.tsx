import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import SelectMenuJs from '@/components/ui/SelectMenu'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

// Tenant default a vacancy inherits when it has no application settings of its own.
const VACANCY_APP_DEFAULTS_KEY = 'vacancy_default_application_settings'
const FALLBACK_APP_SETTINGS = { cv: 'required', cover_letter: 'optional', photo: 'optional', remarks: 'optional', interview_consent: 'hidden' }

type AnyProps = Record<string, unknown>
const SelectMenu = SelectMenuJs as unknown as ComponentType<AnyProps>

interface ChannelState { value: string; label: string; published: boolean }

// Small accessible on/off toggle (no shared Switch component in the library yet).
function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 38, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--color-primary)' : 'var(--border)', position: 'relative', transition: 'background 0.15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s' }} />
    </button>
  )
}

const APP_FIELDS = ['cv', 'cover_letter', 'photo', 'remarks', 'interview_consent']

/**
 * PublishingTab — job-board channels (publish toggle per channel), the per-vacancy
 * application settings (required/optional/hidden) and the custom fields. All values
 * flow back through onUpdate so the table/record stay in sync. Channel list +
 * defaults come from the tenant lookups (never hardcoded).
 */
export default function PublishingTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void }) {
  const { t } = useTranslation('vacancies')
  const { channels: channelLookup } = useVacancyLookups()
  // Tenant default application settings — a new/empty vacancy inherits these.
  const allSettings = useAllSettings()
  const tenantDefaults = getJsonSetting<Record<string, unknown>>(allSettings, VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS)

  // Merge the configured channels with this vacancy's published state.
  const publishedMap: Record<string, unknown> = Object.fromEntries((v.channels ?? []).map(c => [c.value, c.published]))
  const [channels, setChannels] = useState<ChannelState[]>(
    channelLookup.map(c => ({ value: c.value, label: c.label, published: Boolean(publishedMap[c.value]) }))
  )
  // Vacancy's own settings win; the tenant default fills any gap.
  const [settings, setSettings] = useState<Record<string, unknown>>({ ...tenantDefaults, ...((v.applicationSettings ?? {}) as Record<string, unknown>) })

  // Toggle a channel's published state and persist the full channel set.
  const toggleChannel = (value: string, next: boolean) => {
    const updated = channels.map(c => c.value === value ? { ...c, published: next } : c)
    setChannels(updated)
    onUpdate?.(v.id, { channels: updated })
  }
  // Set an application-field requirement (required|optional|hidden) and persist.
  const setField = (field: string, value: unknown) => {
    const updated = { ...settings, [field]: value }
    setSettings(updated)
    onUpdate?.(v.id, { applicationSettings: updated })
  }

  const valueOptions = [
    { value: 'required', label: t('publishing.values.required') },
    { value: 'optional', label: t('publishing.values.optional') },
    { value: 'hidden',   label: t('publishing.values.hidden') },
  ]

  return (
    <div>
      {/* Application settings */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('publishing.applicationSettings')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {APP_FIELDS.map(field => (
          <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{t(`publishing.fields.${field}`)}</span>
            <div style={{ width: 150 }}>
              <SelectMenu value={settings[field] ?? 'optional'} options={valueOptions} onChange={(v2: unknown) => setField(field, v2)} menuWidth={150} />
            </div>
          </div>
        ))}
      </div>

      {/* Job boards */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('publishing.channels')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {channels.map(c => (
          <div key={c.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{c.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: c.published ? 'var(--color-success)' : 'var(--text-muted)' }}>
                {c.published ? t('publishing.publishedOn') : t('publishing.notPublished')}
              </span>
              <Toggle on={c.published} onChange={next => toggleChannel(c.value, next)} label={c.label} />
            </div>
          </div>
        ))}
      </div>
      {/* Custom fields moved to their own conditional "Extra" tab (mirror candidate). */}
    </div>
  )
}
