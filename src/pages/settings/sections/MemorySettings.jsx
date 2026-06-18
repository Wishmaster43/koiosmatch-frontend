import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { loadSettings, saveSettings } from '../lib/settingsApi'

export default function MemorySettings() {
  const { t } = useTranslation('settings')
  const [notes,   setNotes]   = useState('')
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings().then(s => { if (s.memory_notes) setNotes(s.memory_notes) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try { await saveSettings({ memory_notes: notes }); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch { /* noop */ } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('memory.title')}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('memory.subtitle')}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin"/> {t('common.saving')}</> : <><Save size={13}/> {t('common.save')}</>}
        </button>
      </div>
      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('common.loadingShort')}</p> : (
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={t('memory.placeholder')}
          style={{ width: '100%', minHeight: 220, padding: 14, fontSize: 13, border: '1px solid #E5E7EB',
                   borderRadius: 10, outline: 'none', resize: 'vertical', color: '#111827', fontFamily: 'inherit', lineHeight: 1.6 }} />
      )}
    </div>
  )
}
