/** NotificationsSettings — per-context (applications / vacancies / billing) email +
 * in-app notification preferences, stored as `notif_<context>_<channel>`. */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save } from 'lucide-react'
import { PermissionToggle } from '../components/SettingsControls'
import { loadSettings, saveSettings } from '../lib/settingsApi'

export default function NotificationsSettings({ context }) {
  const { t } = useTranslation('settings')
  const title = t(`notifications.context.${context}.title`, context)
  const desc  = t(`notifications.context.${context}.desc`, '')
  const [prefs,   setPrefs]   = useState({ email: true, in_app: true })
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    loadSettings().then(s => {
      const e = s[`notif_${context}_email`]; const i = s[`notif_${context}_in_app`]
      if (e !== undefined) setPrefs(p => ({ ...p, email: e === 'true' || e === true }))
      if (i !== undefined) setPrefs(p => ({ ...p, in_app: i === 'true' || i === true }))
    }).catch(() => {})
  }, [context])

  const save = async () => {
    setSaving(true)
    try {
      await saveSettings({ [`notif_${context}_email`]: String(prefs.email), [`notif_${context}_in_app`]: String(prefs.in_app) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  const options = [
    { key: 'email',  label: t('notifications.email.label'),  desc: t('notifications.email.desc') },
    { key: 'in_app', label: t('notifications.inApp.label'),  desc: t('notifications.inApp.desc') },
  ]

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{desc}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> {t('common.saved')}</> : <><Save size={13}/> {t('common.save')}</>}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map(opt => (
          <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{opt.desc}</div>
            </div>
            <PermissionToggle checked={prefs[opt.key]} onChange={() => setPrefs(p => ({ ...p, [opt.key]: !p[opt.key] }))} />
          </div>
        ))}
      </div>
    </div>
  )
}
