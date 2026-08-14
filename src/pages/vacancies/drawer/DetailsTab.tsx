import { useTranslation } from 'react-i18next'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useVacancyAdvice } from '@/lib/useVacancyAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
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
 * DetailsTab — thin container: wires useVacancyDetailsForm and stacks EVERY
 * field group as its own card on this ONE tab (VAC-ALGEMEEN-MERGE-1, Danny
 * 14-08 punt 9: "het Locatie-subtabblad verdwijnt: op het eerste tabblad
 * Algemeen staat ALLES in eigen blokjes"). The earlier Algemeen/Locatie/Eisen/
 * Voorwaarden SubTabBar (VAC-DETAILS-SPLIT-1) is gone — each Details<X>Tab
 * still keeps its OWN pencil/save/cancel from its OWN hook section, so
 * editing one block never submits another's untouched draft; only the
 * navigation chrome around them (the sub-tab strip) was removed. No card/row
 * JSX lives here — that stays in detailsFieldKit + the four Details<X>Tab
 * siblings; this file only owns the block order and the shared Koios
 * advisory block (still bottom-of-tab, unaffected by the merge).
 */
export default function DetailsTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  // KOIOS-ADVIES-OVERAL-1: the SAME resolver the vacancies table's Koios column
  // uses — the advisory block below prepends its advice so the two never disagree.
  const resolveAdvice = useVacancyAdvice()
  const { candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    contractTypeOptions, caoOptions,
    general, location, requirements, conditions } = useVacancyDetailsForm(v, onUpdate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Klant, locatie(vestiging)/afdeling/contactpersoon-cascade, contractvorm,
          functie — the "Algemeen" block, first. */}
      <DetailsGeneralTab vacancy={v} general={general} candidateTypes={candidateTypes} typeMeta={typeMeta}
        industries={industries} fnOptions={fnOptions} formatDate={formatDate} />
      {/* Werkadres (straat/postcode/plaats/land/provincie) + de eigen vestiging
          (location_id) van de vacature — VAC-VESTIGING-1's picker, nu zichtbaar
          op dit eerste tabblad in plaats van een apart Locatie-subtabblad. */}
      <DetailsLocationTab vacancy={v} location={location} />
      <DetailsRequirementsTab vacancy={v} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />
      <DetailsConditionsTab vacancy={v} conditions={conditions} contractTypeOptions={contractTypeOptions} caoOptions={caoOptions} />
      {/* V11 + Danny 05-08 "Koios moet eronder komen": advisory stays at the
          bottom of the merged tab, unaffected by the sub-tab removal. */}
      <KoiosAdviceBlock namespace="vacancies"
        insights={[...adviceInsightRows(resolveAdvice(v)), ...buildVacancyAdviceInsights(v, t)]} />
    </div>
  )
}
