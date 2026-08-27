/** AppsSettings — toggle external app connectors (with monthly-cost + package warnings). */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import { useApps, AVAILABLE_APPS } from '@/context/AppsContext'
import { canAccessPage } from '@/lib/access'
import Toggle from '@/components/ui/Toggle'
import { readableOn } from '@/hooks/useTenantTheme'

// Connector toggles gated on super-admin + package: shows an honest disabled state, never a clickable 403.
export default function AppsSettings() {
  const { t } = useTranslation('settings')
  const { enabled, setApps } = useApps()
  const auth                        = useAuth()
  const { hasPermission }           = auth
  const [saving, setSaving]         = useState(null)
  const [saved,  setSaved]          = useState(null)
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

  // Flip one app's enabled flag, persist it, and surface a real error (invalid slug, no permission) rather than a silent no-op.
  const toggle = async (appId) => {
    if (!canEdit) return
    const newEnabled = enabled.includes(appId)
      ? enabled.filter(id => id !== appId)
      : [...enabled, appId]
    setSaving(appId)
    try {
      await api.put('/settings/apps', { enabled: newEnabled })
      setApps(newEnabled)
      setSaved(appId); setTimeout(() => setSaved(null), 2000)
    } catch (err) {
      // Surface the real reason (422 invalid slug / 403 no super-admin/package) —
      // the silent noop hid the hf-slug 422 entirely (Danny 23-07).
      notifyError(extractApiError(err, t('common:actionFailed')))
    }
    setSaving(null)
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Package context banner — shown when the active tenant is NOT on package 3 yet.
          Sky shades have no exact/close index.css token match; kept literal to avoid changing the rendered tone. */}
      {!tenantHasConnectors && (
        /* eslint-disable no-restricted-syntax -- no exact/close index.css token match for these banner sky shades; kept literal to avoid changing the rendered tone */
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
                      background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, marginBottom: 16 }}>
          <AlertTriangle size={15} color="#0369A1" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0369A1' }}>{t('apps.notOnPkg3Title')}</div>
            <div style={{ fontSize: 12, color: '#0284C7', marginTop: 2 }}>{t('apps.notOnPkg3Desc')}</div>
          </div>
        </div>
        /* eslint-enable no-restricted-syntax */
      )}

      {!canEdit && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, padding: '10px 14px',
                      background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          {isSuperAdmin ? t('apps.adminOnly') : t('apps.superadminOnly')}
        </div>
      )}

      {/* Tab strip — same look as JobQueueSettings/ApiKeyDetail's inline tabs. */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {[['planning', t('apps.tabPlanning')], ['backoffice', t('apps.tabBackoffice')], ['telefonie', t('apps.tabTelefonie')], ['verificatie', t('apps.tabVerificatie')], ['koios_ai', t('apps.tabKoiosAi')]].map(([id, label]) => {
          const active = id === tab
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13,
                // Text colour uses the AA-contrast primary-text token, not the raw accent (P2b).
                fontWeight: active ? 600 : 500, color: active ? 'var(--color-primary-text)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AVAILABLE_APPS.filter(app => app.group === tab).map(app => {
          const on = enabled.includes(app.id)
          const isSaving = saving === app.id
          const isSaved  = saved  === app.id
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
                disabled={!canEdit || isSaving || soon}
                title={soon ? t('apps.comingSoon') : !canEdit ? t('apps.noRights') : on ? t('apps.disable') : t('apps.enable')} />
              {isSaved && <Check size={14} color="var(--color-success)" style={{ flexShrink: 0 }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
