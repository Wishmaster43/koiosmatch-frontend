import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildVacancyAdviceInsights } from './vacancyAiInsights'
import { useVacancyDetailsForm } from '../hooks/useVacancyDetailsForm'
import DetailsGeneralTab from './DetailsGeneralTab'
import DetailsLocationTab from './DetailsLocationTab'
import DetailsRequirementsTab from './DetailsRequirementsTab'
import DetailsConditionsTab from './DetailsConditionsTab'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

/**
 * DetailsTab — thin container: wires useVacancyDetailsForm and declares the
 * Algemeen/Locatie/Eisen/Voorwaarden sub-tabs (VAC-DETAILS-SPLIT-1, Danny
 * 24-07: "een potlood zet 21 velden tegelijk in edit-mode ... ruk om te
 * onderhouden"). Mirrors PreferencesZzpTabs' SubTabBar convention: every
 * card gets its OWN pencil/save/cancel from its own hook section, so editing
 * one sub-tab never submits another's untouched draft. No card/row JSX lives
 * here anymore — that moved into detailsFieldKit + the four Details<X>Tab
 * siblings; this file only owns the sub-tab strip and the shared Koios
 * advisory block (unaffected by which sub-tab is active).
 */
export default function DetailsTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const { candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    general, location, requirements, conditions } = useVacancyDetailsForm(v, onUpdate)

  // Sub-tab strip — reuses the four EXISTING group labels (details.groups.*),
  // no new i18n keys needed.
  const SUB_TABS = [
    { id: 'general', label: t('details.groups.general') },
    { id: 'location', label: t('details.groups.location') },
    { id: 'requirements', label: t('details.groups.requirements') },
    { id: 'conditions', label: t('details.groups.conditions') },
  ]
  const [subTab, setSubTab] = useState('general')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
      {subTab === 'general' && (
        <>
          {/* V11 (Danny vacatures-ronde): Koios advisory only on Algemeen, ABOVE
              the fields card (was rendered unconditionally below every sub-tab). */}
          <KoiosAdviceBlock namespace="vacancies" insights={buildVacancyAdviceInsights(v, t)} />
          <DetailsGeneralTab vacancy={v} general={general} candidateTypes={candidateTypes} typeMeta={typeMeta}
            industries={industries} fnOptions={fnOptions} formatDate={formatDate} />
        </>
      )}
      {subTab === 'location' && <DetailsLocationTab vacancy={v} location={location} />}
      {subTab === 'requirements' && (
        <DetailsRequirementsTab vacancy={v} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />
      )}
      {subTab === 'conditions' && <DetailsConditionsTab vacancy={v} conditions={conditions} />}
    </div>
  )
}
