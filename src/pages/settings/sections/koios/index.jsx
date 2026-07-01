/**
 * KoiosSettings — the Koios AI settings section (screen B): connection status,
 * models and rates, read from GET /ai/koios/settings. A 403 (tenant lacks the
 * module / user lacks koios.use) degrades to a calm "unavailable" notice rather
 * than an error. Usage (C) and admin (D) tabs land in later slices.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/lib/datetime'
import { getKoiosSettings } from './koiosApi'
import KoiosStatusCard from './KoiosStatusCard'
import KoiosModelsCard from './KoiosModelsCard'
import KoiosPricingCard from './KoiosPricingCard'

const notice = { fontSize: 13, color: 'var(--text-muted)' }

export default function KoiosSettings() {
  const { t } = useTranslation('koios')
  const locale = useLocale()
  const [settings, setSettings] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | ready | unavailable | error

  // Load the Koios settings once; a 403 means "not entitled" (calm notice).
  useEffect(() => {
    let alive = true
    getKoiosSettings()
      .then((d) => { if (alive) { setSettings(d); setPhase('ready') } })
      .catch((e) => { if (alive) setPhase(e?.response?.status === 403 ? 'unavailable' : 'error') })
    return () => { alive = false }
  }, [])

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="mb-6">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('title')}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('subtitle')}</p>
      </div>

      {phase === 'loading'     && <p style={notice}>{t('loading')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('unavailable')}</p>}
      {phase === 'error'       && <p style={notice}>{t('loadError')}</p>}

      {phase === 'ready' && (
        <>
          <KoiosStatusCard status={settings?.status} t={t} />
          <KoiosModelsCard models={settings?.models} t={t} />
          <KoiosPricingCard pricing={settings?.pricing} currency={settings?.currency} locale={locale} t={t} />
        </>
      )}
    </div>
  )
}
