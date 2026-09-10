/** AppsSettings — toggle external app connectors (with monthly-cost + package warnings). */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SaveButton from '@/components/ui/SaveButton'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import { useApps, AVAILABLE_APPS } from '@/context/AppsContext'
import { canAccessPage } from '@/lib/access'
import Toggle from '@/components/ui/Toggle'
import CalloutBox from '@/components/ui/CalloutBox'
import SubTabBar from '@/components/drawer/SubTabBar'
import { readableOn } from '@/hooks/useTenantTheme'

// Connector toggles gated on super-admin + package: shows an honest disabled state, never a clickable 403.
export default function AppsSettings() {
  const { t } = useTranslation('settings')
  const { enabled, setApps } = useApps()
  const auth                        = useAuth()
  const { hasPermission }           = auth
  const [saving, setSaving]         = useState(false)
  const [saved,  setSaved]          = useState(false)
  // Toggles only edit this draft; ONE Save persists it (Danny 09-09: activating on every
  // toggle made the switch wait for the backend, and Pakketkeuze already saves with a button).
  const [draft, setDraft]           = useState(enabled)
  const dirty = JSON.stringify([...draft].sort()) !== JSON.stringify([...enabled].sort())
  // APPS-GROUPS-3 (Danny 23-07): ONE shell entry, with an internal LINE tab strip —
  // the exact taakbeheer/ApiKeyDetail pattern, never boxed pills.
  const [tab, setTab]               = useState('planning')
  // APPS-SUPERADMIN-1 (Danny 23-07 403): connectors are PLATFORM-provisioned — the
  // backend refuses everyone but a super admin (by design, 2026-06-23), so a tenant
  // admin must see honest disabled toggles + a notice, never a clickable 403.
  const isSuperAdmin = auth?.isSuperAdmin?.() ?? false
  const canEdit = hasPermission('settings.update') && isSuperAdmin
  // True when the active tenant's package includes connectors (package 3).
  const tenantHasConnectors = canAccessPage('apps', auth)

  // Flip one app's flag in the draft; nothing is persisted until Save.
  const toggle = (appId) => {
    if (!canEdit) return
    setDraft(prev => (prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]))
  }

  // Persist the whole draft in one PUT and surface a real error (invalid slug, no
  // permission) rather than a silent no-op; a failure keeps the draft for a retry.
  const save = async () => {
    if (!canEdit || !dirty) return
    setSaving(true)
    try {
      await api.put('/settings/apps', { enabled: draft })
      setApps(draft)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      // Surface the real reason (422 invalid slug / 403 no super-admin/package) —
      // the silent noop hid the hf-slug 422 entirely (Danny 23-07).
      notifyError(extractApiError(err, t('common:actionFailed')))
    }
    setSaving(false)
  }

  const tabs = [
    { id: 'planning', label: t('apps.tabPlanning') },
    { id: 'backoffice', label: t('apps.tabBackoffice') },
    { id: 'telefonie', label: t('apps.tabTelefonie') },
    { id: 'verificatie', label: t('apps.tabVerificatie') },
    { id: 'koios_ai', label: t('apps.tabKoiosAi') },
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Package context banner — shown when the active tenant is NOT on package 3 yet.
          Uses the shared CalloutBox atom (§4) instead of hand-painted hex. */}
      {!tenantHasConnectors && (
        <div style={{ marginBottom: 16 }}>
          <CalloutBox variant="info" title={t('apps.notOnPkg3Title')}>
            {t('apps.notOnPkg3Desc')}
          </CalloutBox>
        </div>
      )}

      {!canEdit && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, padding: '10px 14px',
                      background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {isSuperAdmin ? t('apps.adminOnly') : t('apps.superadminOnly')}
        </div>
      )}

      {/* Tab strip — the shared SubTabBar (DRY-1 O5); the wrapper keeps the old outer margin. */}
      <div style={{ marginBottom: 20 }}>
        <SubTabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AVAILABLE_APPS.filter(app => app.group === tab).map(app => {
          const on = draft.includes(app.id)
          const soon = !!app.comingSoon
          return (
            <div key={app.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 18px', borderRadius: 12,
              border: `1.5px solid ${on ? 'var(--color-success)' : 'var(--border)'}`,
              background: on ? 'var(--color-success-bg)' : 'var(--surface)',
              transition: 'all 0.15s',
              opacity: !canEdit && !on ? 0.6 : 1,
            }}>
              <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
                             background: (app.image || app.Mark) ? 'var(--surface)' : app.color,
                             border: (app.image || app.Mark) ? '1px solid var(--border)' : 'none',
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             filter: soon ? 'grayscale(1)' : 'none', opacity: soon ? 0.55 : 1 }}>
                {app.Mark
                  ? <app.Mark size={34} />
                  : app.image
                    ? <img src={app.image} alt={app.label} width={34} height={34} style={{ objectFit: 'contain' }} />
                    // Letter badge sits on the app's own fixed brand colour (AVAILABLE_APPS
                    // data, not the tenant accent) — some of those swatches are light enough
                    // that a hardcoded white fails contrast, so pick per-app like TenantSwitcher does.
                    : <span style={{ fontSize: 15, fontWeight: 800, color: readableOn(app.color), letterSpacing: '0.02em' }}>
                        {app.label.slice(0, 2).toUpperCase()}
                      </span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{app.label}</span>
                  {on && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-on-success-bg)',
                                   background: 'var(--color-success-bg)', borderRadius: 999, padding: '1px 7px' }}>
                      {t('apps.active')}
                    </span>
                  )}
                  {soon && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                                   background: 'var(--hover-bg)', border: '1px solid var(--border)',
                                   borderRadius: 999, padding: '1px 7px' }}>
                      {t('apps.comingSoon')}
                    </span>
                  )}
                  {app.monthly && !soon && (
                    <span style={{ fontSize: 10, color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)',
                                   borderRadius: 999, padding: '1px 7px', fontWeight: 500 }}>
                      {t('apps.monthly')}
                    </span>
                  )}
                </div>
                {/* The catalogue keeps the Dutch source as the fallback; the copy itself is translated. */}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{t(`appsCatalog.${app.id}`, { defaultValue: app.description })}</div>
              </div>
              {/* Shared house Toggle (audit finding, 05-08) — replaces the hand-rolled
                  44x24 success-green pill so every on/off control looks the same. */}
              <Toggle checked={on && !soon} onChange={() => { if (!soon) toggle(app.id) }}
                disabled={!canEdit || saving || soon}
                title={soon ? t('apps.comingSoon') : !canEdit ? t('apps.noRights') : on ? t('apps.disable') : t('apps.enable')} />
            </div>
          )
        })}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
          {/* No explicit children: SaveButton's own saved/saving/save face (DRY round 11, SETTINGS2)
              renders the identical Check/Spinner/Save + common:saved/saving/save this screen used to hand-roll. */}
          <SaveButton onClick={save} disabled={saving || !dirty} saved={saved} saving={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }} />
        </div>
      )}
    </div>
  )
}
