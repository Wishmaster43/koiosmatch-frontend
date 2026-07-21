/**
 * VacancyGenerationSettings — Settings → AI → Vacaturegeneratie (VACGEN-1 fase 1):
 * the management screen for tenant AI generation PROFILES. Danny wants several
 * profiles instead of one template; a later resolver (fase 1b, not built here)
 * will auto-pick the best-matching profile per vacancy characteristic. This
 * screen is only the CRUD surface — thin container with an internal sub-tab
 * strip (Profiles / Reusable blocks) switching between the two related CRUD
 * lists, mirroring how other settings screens keep one registry entry for
 * several related lists instead of a nav entry each.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import VacancyGenerationProfilesList from './VacancyGenerationProfilesList'
import VacancyContentBlocksSettings from './VacancyContentBlocksSettings'

export default function VacancyGenerationSettings() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState('profiles')

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('vacancyGenerationSettings.title')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t('vacancyGenerationSettings.subtitle')}</p>
      </div>

      {/* Internal sub-tabs — one screen, two related CRUD lists (profiles + their
          reusable blocks) instead of a second top-level nav entry. */}
      <div style={{ marginBottom: 16 }}>
        <SubTabBar
          tabs={[
            { id: 'profiles', label: t('vacancyGenerationSettings.tabProfiles') },
            { id: 'blocks', label: t('vacancyGenerationSettings.tabBlocks') },
          ]}
          active={tab} onChange={setTab}
        />
      </div>

      {tab === 'profiles' ? <VacancyGenerationProfilesList /> : <VacancyContentBlocksSettings />}
    </div>
  )
}
