import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import SelectMenuJs from '@/components/ui/SelectMenu'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS } from '../data/applicationSettingsDefaults'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

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
 * defaults come from the tenant lookups (never hardcoded). Split into two
 * sub-tabs (Instellingen / Vacaturesites) via the shared SubTabBar (V15),
 * mirroring DetailsTab's sub-tab convention — no behaviour change, render only.
 */
export default function PublishingTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void }) {
  const { t } = useTranslation('vacancies')
  const { channels: channelLookup } = useVacancyLookups()
  // Tenant default application settings — a new/empty vacancy inherits these.
  const allSettings = useAllSettings()
  const tenantDefaults = getJsonSetting<Record<string, unknown>>(allSettings, VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS)

  // Merge the configured channels with this vacancy's published state. A channel
  // the tenant deactivated in Settings (CHANNEL-FLAGS-1, round-4 audit finding #3)
  // drops off the publish panel entirely — a retired job board must not leave a
  // dead toggle a recruiter can still flip. An empty `v.channels` means the
  // backend has no publish rows yet (a brand-new vacancy) — pre-check the
  // tenant's default_enabled channels instead of defaulting everything to off;
  // once ANY channel state has been saved, the vacancy's own record wins for
  // every channel (untouched ones stay off, never silently re-enabled).
  const hasSavedChannelState = (v.channels ?? []).length > 0
  const publishedMap: Record<string, unknown> = Object.fromEntries((v.channels ?? []).map(c => [c.value, c.published]))
  const [channels, setChannels] = useState<ChannelState[]>(
    channelLookup
      .filter(c => c.active !== false)
      .map(c => ({
        value: c.value,
        label: c.label,
        published: hasSavedChannelState ? Boolean(publishedMap[c.value]) : Boolean(c.default_enabled),
      }))
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

  // Sub-tab strip — Instellingen (application settings) / Vacaturesites (channels).
  const SUB_TABS = [
    { id: 'settings', label: t('publishing.tabs.settings') },
    { id: 'sites', label: t('publishing.tabs.sites') },
  ]
  const [subTab, setSubTab] = useState('settings')

  return (
    <div>
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'settings' && (
        <div style={{ marginTop: 12 }}>
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
        </div>
      )}

      {subTab === 'sites' && (
        <div style={{ marginTop: 12 }}>
          {/* Job boards */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('publishing.channels')}</div>
          {/* Honest state (Danny 13/7): the toggles record WHAT will be published; the
              public career site + channel feeds (CAREER-1/PUBLISH-1) are not live yet,
              so never claim "Gepubliceerd" as if something is already out there. */}
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px', marginBottom: 10, background: 'var(--bg)' }}>
            {t('publishing.notLiveYet')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {channels.map(c => (
              <div key={c.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{c.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: c.published ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {c.published ? t('publishing.queuedOn') : t('publishing.notPublished')}
                  </span>
                  <Toggle on={c.published} onChange={next => toggleChannel(c.value, next)} label={c.label} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Custom fields moved to their own conditional "Extra" tab (mirror candidate). */}
    </div>
  )
}
