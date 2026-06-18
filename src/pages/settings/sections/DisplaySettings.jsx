import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { loadSettings, saveSettings } from '../lib/settingsApi'

// Keys + default values; labels/descriptions/units come from i18n (display.fields.*).
const DEFAULT_DISPLAY = [
  { key: 'candidates_per_page', value: 500 },
  { key: 'top_cities_n',        value: 10 },
  { key: 'shifts_detail_limit', value: 500 },
  { key: 'activity_log_limit',  value: 200 },
]

export default function DisplaySettings() {
  const { t } = useTranslation('settings')
  const [items,   setItems]   = useState(DEFAULT_DISPLAY.map(k => ({ ...k })))
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  const update = (key, val) =>
    setItems(prev => prev.map(k => k.key === key ? { ...k, value: Number(val) } : k))

  useEffect(() => {
    loadSettings()
      .then(stored => setItems(prev => prev.map(k => stored[k.key] !== undefined ? { ...k, value: Number(stored[k.key]) } : k)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    const payload = {}
    items.forEach(k => (payload[k.key] = k.value))
    try {
      await saveSettings(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('display.title')}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('display.subtitle')}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                   border: 'none', opacity: saving ? 0.7 : 1,
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved  ? <><Check size={13} /> {t('common.saved')}</>                           :
           saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> :
                    <><Save size={13} /> {t('common.save')}</>}
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>{t('common.loading')}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.key}
            style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10,
                     padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{t(`display.fields.${item.key}.label`)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{t(`display.fields.${item.key}.description`)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <input type="number" min={1} value={item.value}
                onChange={e => update(item.key, e.target.value)}
                style={{ width: 80, height: 34, textAlign: 'right', padding: '0 10px', fontSize: 14,
                         fontWeight: 600, color: '#111827', border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }} />
              <span style={{ fontSize: 12, color: '#9CA3AF', width: 60 }}>{t(`display.fields.${item.key}.unit`)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
