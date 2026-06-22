import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Check } from 'lucide-react'
import api from '../../../lib/api'
import Slider from '../../../components/ui/Slider'

/**
 * VacancyMatchingSettings — the GLOBAL matching strictness (how critical the AI
 * matcher is overall). The per-vacancy dimension importance (qualifications,
 * location, …) lives on each vacancy itself, not here. Persists to /settings/matching.
 */
// The backend strictness is an enum; the slider is a 3-step index onto it.
const LEVELS = ['lenient', 'balanced', 'strict']

export default function VacancyMatchingSettings() {
  const { t } = useTranslation('settings')
  const [level, setLevel] = useState(1) // index into LEVELS (1 = balanced default)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  // Load the saved strictness enum → slider index (fail soft to balanced).
  useEffect(() => {
    api.get('/settings/matching')
      .then(r => { const i = LEVELS.indexOf((r.data?.data ?? r.data)?.strictness); if (i >= 0) setLevel(i) })
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try { await api.put('/settings/matching', { strictness: LEVELS[level] }); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch { /* noop */ } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 16, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('matching.title')}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('matching.subtitle')}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500,
            borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> {t('matching.saved')}</> : <><Save size={13} /> {t('matching.save')}</>}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Slider value={level} max={2} step={1} onChange={setLevel}
          labels={[t('matching.lenient'), t('matching.balanced'), t('matching.strict')]} ariaLabel={t('matching.title')} />
      </div>

      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 22 }}>{t('matching.perVacancyHint')}</p>
    </div>
  )
}
