import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import SelectMenuJs from '@/components/ui/SelectMenu'
import SubTabBar from '@/components/drawer/SubTabBar'
import SelectAllRow from '@/components/ui/SelectAllRow'
import { GroupLabel } from '@/components/ui/typography'
import Toggle from '@/components/ui/Toggle'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAllSettings, getJsonSetting, getBoolSetting } from '@/lib/settings/useAllSettings'
import { VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS } from '../data/applicationSettingsDefaults'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const SelectMenu = SelectMenuJs as unknown as ComponentType<AnyProps>

interface ChannelState { value: string; label: string; published: boolean }

const APP_FIELDS = ['cv', 'cover_letter', 'photo', 'remarks', 'interview_consent']

/**
 * PublishingTab — job-board channels (publish toggle per channel), the per-vacancy
 * application settings (required/optional/hidden) and the custom fields. All values
 * flow back through onUpdate so the table/record stay in sync. Channel list +
 * defaults come from the tenant lookups (never hardcoded). Split into two
 * sub-tabs (Instellingen / Vacaturesites) via the shared SubTabBar (V15),
 * mirroring DetailsTab's sub-tab convention — no behaviour change, render only.
 *
 * CAREER-SITE-ACTIVE: the 'career' channel toggle is a REAL control — its saved
 * state (via onUpdate → `channels` → PATCH `published_channels`) is what the
 * backend's PublicVacancyQuery/ChannelGate reads to decide whether this vacancy
 * is eligible on the public career site (and, by extension, the Indeed/Werkzoeken
 * feeds and the sitemap, which share the same eligibility query). The tenant's
 * own `career_site_active` setting is a second, independent gate on top of every
 * channel toggle — read here so the panel never claims something is live that the
 * tenant hasn't switched on yet.
 */
export default function PublishingTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void }) {
  const { t } = useTranslation('vacancies')
  const { channels: channelLookup } = useVacancyLookups()
  // Tenant default application settings — a new/empty vacancy inherits these.
  const allSettings = useAllSettings()
  const tenantDefaults = getJsonSetting<Record<string, unknown>>(allSettings, VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS)
  // CAREER-SITE-ACTIVE (backend EnsureCareerSiteActive middleware): the ONE tenant
  // switch (Settings → Career site) that gates the ENTIRE public surface these
  // toggles feed into — the career site itself, applying, the sitemap, and the
  // Indeed/Werkzoeken feeds all sit behind it (routes/api/career.php). Reading it
  // here lets the panel tell the truth about whether a toggle is live right now
  // or merely queued for when the tenant switches the site on.
  const careerSiteActive = getBoolSetting(allSettings, 'career_site_active', false)

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
  // Build the merged channel list from the current vacancy's own saved state.
  const buildChannels = (): ChannelState[] => channelLookup
    .filter(c => c.active !== false)
    .map(c => ({
      value: c.value,
      label: c.label,
      published: hasSavedChannelState ? Boolean(publishedMap[c.value]) : Boolean(c.default_enabled),
    }))
  const [channels, setChannels] = useState<ChannelState[]>(buildChannels)
  // Vacancy's own settings win; the tenant default fills any gap.
  const buildSettings = (): Record<string, unknown> => ({ ...tenantDefaults, ...((v.applicationSettings ?? {}) as Record<string, unknown>) })
  const [settings, setSettings] = useState<Record<string, unknown>>(buildSettings)
  // Sub-tab strip state — declared before the resync effect below, which
  // resets it whenever the vacancy identity changes (no forward reference).
  const [subTab, setSubTab] = useState('settings')

  // V-PUB-1: resync channels/settings/subTab whenever the vacancy identity changes —
  // without this, switching drawer target left stale channel/settings state from the
  // previous vacancy on screen (mirrors MatchingTab's v.id-keyed resync effect).
  useEffect(() => {
    setChannels(buildChannels())
    setSettings(buildSettings())
    setSubTab('settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.id])

  // Toggle a channel's published state and persist the full channel set.
  const toggleChannel = (value: string, next: boolean) => {
    const updated = channels.map(c => c.value === value ? { ...c, published: next } : c)
    setChannels(updated)
    onUpdate?.(v.id, { channels: updated })
  }
  // S-selectall-1: batch-flip the given channels in ONE persisted patch (never a
  // per-channel loop — toggleChannel above reads `channels` from the render
  // closure, so a loop of single calls would only keep the LAST iteration's write).
  const toggleAllChannels = (values: string[], select: boolean) => {
    const set = new Set(values)
    const updated = channels.map(c => set.has(c.value) ? { ...c, published: select } : c)
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

  return (
    <div>
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'settings' && (
        <div style={{ marginTop: 12 }}>
          {/* Application settings — canon (05-08): the shared GroupLabel atom, reused
              instead of a hand-rolled heading. */}
          <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 8 }}>{t('publishing.applicationSettings')}</GroupLabel>
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
          {/* Job boards — canon (05-08): the shared GroupLabel atom. */}
          <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 8 }}>{t('publishing.channels')}</GroupLabel>
          {/* Honest state (CAREER-SITE-ACTIVE): the tenant-wide switch actually gates
              the public surface (career site + apply + sitemap + Indeed/Werkzoeken
              feeds), so the banner reports the REAL current state instead of a
              permanent "under construction" claim once that backend went live. */}
          <div style={{ fontSize: 11.5, color: chipInk(careerSiteActive ? 'var(--color-success)' : 'var(--color-warning)'),
            border: tintBorder(careerSiteActive ? 'var(--color-success)' : 'var(--color-warning)'),
            borderRadius: 8, padding: '8px 10px', marginBottom: 10,
            background: tintBg(careerSiteActive ? 'var(--color-success)' : 'var(--color-warning)') }}>
            {careerSiteActive ? t('publishing.siteLive') : t('publishing.siteOffline')}
          </div>
          {/* S-selectall-1: alles/niets above the channel list — same shared
              SelectAllRow contract PublicationCard uses in the create modal. */}
          <SelectAllRow
            visibleValues={channels.map(c => c.value)}
            selectedValues={channels.filter(c => c.published).map(c => c.value)}
            onApply={toggleAllChannels}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, marginBottom: 20 }}>
            {channels.map(c => {
              // Real per-row state: only actually live once BOTH this channel's own
              // toggle AND the tenant's site-wide switch are on — otherwise it is
              // saved but queued until the tenant flips the site on.
              const live = c.published && careerSiteActive
              const statusLabel = !c.published ? t('publishing.notPublished') : live ? t('publishing.publishedOn') : t('publishing.queuedOn')
              const statusColor = !c.published ? 'var(--text-muted)' : live ? 'var(--color-success)' : 'var(--color-warning)'
              return (
                <div key={c.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                  {/* Canon (05-08): 12px, matching the identical APP_FIELDS row above. */}
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{c.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: statusColor }}>{statusLabel}</span>
                    <Toggle checked={c.published} onChange={next => toggleChannel(c.value, next)} ariaLabel={c.label} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Custom fields moved to their own conditional "Extra" tab (mirror candidate). */}
    </div>
  )
}
