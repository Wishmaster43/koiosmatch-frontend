/**
 * DetailsTab — thin container: wires useVacancyDetailsForm and stacks EVERY
 * field group as its own card on this ONE tab (VAC-ALGEMEEN-MERGE-1, Danny
 * 14-08 punt 9: "the Location sub-tab disappears: on the first tab, General,
 * EVERYTHING sits in its own little blocks"). The earlier General/Location/Requirements/
 * Conditions SubTabBar (VAC-DETAILS-SPLIT-1) is gone — each Details<X>Tab
 * still keeps its OWN pencil/save/cancel from its OWN hook section, so
 * editing one block never submits another's untouched draft; only the
 * navigation chrome around them (the sub-tab strip) was removed. No card/row
 * JSX lives here — that stays in detailsFieldKit + the four Details<X>Tab
 * siblings; this file only owns the block order and the shared Koios
 * advisory block (still bottom-of-tab, unaffected by the merge).
 */
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useVacancyAdvice } from '@/lib/useVacancyAdvice'
import { useKoiosAdviceRun } from '@/lib/useKoiosAdviceRun'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import { buildVacancyAdviceInsights } from './vacancyAiInsights'
import { useVacancyDetailsForm } from '../hooks/useVacancyDetailsForm'
import DetailsGeneralTab from './DetailsGeneralTab'
import DetailsLocationTab from './DetailsLocationTab'
import DetailsRequirementsTab from './DetailsRequirementsTab'
import DetailsConditionsTab from './DetailsConditionsTab'
import VacancyBranchBlock from './VacancyBranchBlock'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

// Thin container: wires useVacancyDetailsForm and stacks every field-group card
// on this one merged tab, in the fixed canon block order (see file doc).
export default function DetailsTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  // KOIOS-ADVIES-OVERAL-1: the SAME resolver the vacancies table's Koios column
  // uses — the advisory block below prepends its advice so the two never disagree.
  const resolveAdvice = useVacancyAdvice()
  const { candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    contractTypeOptions, caoOptions,
    general, location, requirements, conditions } = useVacancyDetailsForm(v, onUpdate)

  // S1 K-266/K-267: the "Advies vernieuwen" button is gated on vacancies.update
  // AND the koios_ai module (EnsureTenantModule on the route — a Core tenant
  // with only koios_assist gets a 403, so the button must not even render for
  // it; mirrors WhatsAppPage's plain hasModule gate) and starts a REAL AI call
  // (API-CREDITS-1).
  const auth = useAuth()
  const canUpdate = (auth?.hasPermission?.('vacancies.update') ?? false) && (auth?.hasModule?.('koios_ai') ?? false)
  // freshAdvice + the run's own pending/notice live in the hook's module-scope
  // store (S1 repair NOTE 3), keyed by the vacancy id, so a paid run survives
  // a tab switch; `v.koiosAiAdvice.runId` lets the hook drop a stale local
  // override once a bulk/workflow refetch brings a genuinely newer one.
  const { request, pending, notice, freshAdvice } = useKoiosAdviceRun('vacancies', v.id, v.koiosAiAdvice?.runId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Customer, location(branch)/department/contact-person cascade, contract form,
          function — the "General" block, first. */}
      <DetailsGeneralTab vacancy={v} general={general} candidateTypes={candidateTypes} typeMeta={typeMeta}
        industries={industries} fnOptions={fnOptions} formatDate={formatDate} />
      {/* Work address (street/postcode/city/country/province) — the vacancy's own
          agency branch (location_id) no longer lives on this card;
          it is now the drill-down's own LAST block (VacancyBranchBlock, below). */}
      <DetailsLocationTab vacancy={v} location={location} />
      <DetailsRequirementsTab vacancy={v} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />
      <DetailsConditionsTab vacancy={v} conditions={conditions} contractTypeOptions={contractTypeOptions} caoOptions={caoOptions} />
      {/* V11 + Danny 05-08 "Koios moet eronder komen": advisory stays at the
          bottom of the merged tab, unaffected by the sub-tab removal. */}
      <KoiosAdviceBlock namespace="vacancies"
        insights={[...adviceInsightRows(resolveAdvice(v)), ...buildVacancyAdviceInsights(v, t)]}
        contextRef={v.id ? { type: 'vacancy', id: String(v.id), label: v.title ?? '' } : undefined}
        aiAdvice={freshAdvice !== undefined ? freshAdvice : v.koiosAiAdvice}
        onRequestAdvice={canUpdate ? request : undefined}
        advicePending={pending}
        adviceNotice={notice}
      />
      {/* DRILLDOWN-VOLGORDE-CANON (Danny 21-08): informatie → vrije tekst (own
          tab) → Koios AI → vestiging LAST — the bureau branch picker closes
          out the drill-down, mirroring the candidate/match canon. */}
      <VacancyBranchBlock vacancy={v} onUpdate={onUpdate} />
    </div>
  )
}
