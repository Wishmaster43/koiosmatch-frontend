/**
 * KoiosSettings — the Koios AI settings section (screen B): connection status
 * and models, read from GET /ai/koios/settings. A 403 (tenant lacks the module /
 * user lacks koios.use) degrades to a calm "unavailable" notice rather than an
 * error. Usage (C) and admin (D) tabs land in later slices.
 *
 * KOIOS-MODEL-VOCAB-1 (27-08, measured): the controller no longer returns a
 * `pricing` field — raw model rates are a platform/super-admin concern, and the
 * old KoiosPricingCard (which rendered raw model ids ungated) was removed rather
 * than kept as dead code that would leak them if pricing ever returned non-null.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getKoiosSettings } from './koiosApi'
import KoiosStatusCard from './KoiosStatusCard'
import KoiosModelsCard from './KoiosModelsCard'
import KoiosLearningCard from './KoiosLearningCard'
import KoiosCapabilitiesCard from './KoiosCapabilitiesCard'
import KoiosFeedbackCard from './KoiosFeedbackCard'
import { PageTitle } from '@/components/ui/typography'
import SubTabBar from '@/components/drawer/SubTabBar'
// KOIOS-DEFAULT-SYNC-1: the floating panel reads the same settings from the
// shared query cache — invalidate it so its picker follows a new default.
import { invalidateKoiosSettings } from '@/components/layout/koios/useKoiosSettings'

const notice = { fontSize: 13, color: 'var(--text-muted)' }

// Koios AI settings screen (status/models/rates); a 403 degrades to a calm unavailable notice rather than an error (see file header).
export default function KoiosSettings() {
  const { t } = useTranslation('koios')
  const [settings, setSettings] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | ready | unavailable | error
  // Sub-tab state: overview (status+models) vs the new learning report (C1-lane 2).
  const [tab, setTab] = useState('overview')
  const TABS = [
    { id: 'overview', label: t('tabs.overview') },
    { id: 'learning', label: t('tabs.learning') },
    { id: 'capabilities', label: t('tabs.capabilities') },
    { id: 'feedback', label: t('tabs.feedback') },
  ]

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
        <PageTitle>{t('title')}</PageTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('subtitle')}</p>
      </div>

      {phase === 'loading'     && <p style={notice}>{t('loading')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('unavailable')}</p>}
      {phase === 'error'       && <p style={notice}>{t('loadError')}</p>}

      {phase === 'ready' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <SubTabBar tabs={TABS} active={tab} onChange={setTab} />
          </div>
          {tab === 'overview' && (
            <>
              <KoiosStatusCard status={settings?.status} t={t} />
              <KoiosModelsCard models={settings?.models} t={t}
                onChanged={(model) => { setSettings((s) => ({ ...s, models: { ...s.models, active: model } })); invalidateKoiosSettings() }} />
            </>
          )}
          {tab === 'learning' && <KoiosLearningCard />}
          {tab === 'capabilities' && <KoiosCapabilitiesCard />}
          {tab === 'feedback' && <KoiosFeedbackCard />}
        </>
      )}
    </div>
  )
}
