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

export default function AppsSettings() {
  const { t } = useTranslation('settings')
  const { enabled, setApps } = useApps()
  const auth                        = useAuth()
  const { hasPermission }           = auth
  const [saving, setSaving]         = useState(null)
  const [saved,  setSaved]          = useState(null)
  const canEdit = hasPermission('settings.update')
  // True when the active tenant's package includes connectors (package 3).
  const tenantHasConnectors = canAccessPage('apps', auth)

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
          {t('apps.adminOnly')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AVAILABLE_APPS.map(app => {
          const on = enabled.includes(app.id)
          const isSaving = saving === app.id
          const isSaved  = saved  === app.id
          return (
            <div key={app.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 18px', borderRadius: 12,
              border: `1.5px solid ${on ? app.border : 'var(--border)'}`,
              background: on ? app.bg : 'var(--surface)',
              transition: 'all 0.15s',
              opacity: !canEdit && !on ? 0.6 : 1,
            }}>
              <div style={{ fontSize: 26, flexShrink: 0, width: 44, height: 44, borderRadius: 10,
                             background: on ? app.color + '18' : 'var(--border)',
                             display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {app.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{app.label}</span>
                  {on && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: app.color,
                                   background: app.color + '18', borderRadius: 999, padding: '1px 7px' }}>
                      {t('apps.active')}
                    </span>
                  )}
                  {app.monthly && (
                    <span style={{ fontSize: 10, color: 'var(--color-warning)', background: 'var(--color-warning-bg)',
                                   borderRadius: 999, padding: '1px 7px', fontWeight: 500 }}>
                      {t('apps.monthly')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{app.description}</div>
              </div>
              <button
                onClick={() => toggle(app.id)}
                disabled={!canEdit || isSaving}
                title={!canEdit ? t('apps.noRights') : on ? t('apps.disable') : t('apps.enable')}
                style={{
                  width: 44, height: 24, borderRadius: 999, border: 'none', flexShrink: 0,
                  background: on ? app.color : 'var(--border)',
                  cursor: canEdit ? 'pointer' : 'not-allowed',
                  position: 'relative', transition: 'background 0.2s',
                  opacity: isSaving ? 0.6 : 1,
                }}>
                <div style={{
                  position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--surface)', transition: 'left 0.2s',
                  left: on ? 22 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
              {isSaved && <Check size={14} color="var(--color-success)" style={{ flexShrink: 0 }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
