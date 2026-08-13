/**
 * TextPopoutPage — TEKST-POPOUT-1: the route dispatcher for every popped-out
 * FREE-TEXT FIELD, the exact twin of NotesPopoutPage for note threads. Lives
 * outside DashboardLayout (see the route in App.tsx) so the whole window is a
 * bare writing surface a recruiter can drag to a second monitor.
 *
 * Reads `:entity`/`:id`/`:field` off the URL and renders that pair's own thin
 * page. Only candidate → profile text exists today; the next field (a customer
 * or vacancy description) is ONE entry in the map below, never a new shape. An
 * unknown pair — a stale or hand-typed URL — shows the shared shell's error state
 * instead of a blank window (§3).
 */
import type { ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PopoutShell from './PopoutShell'
import CandidateSummaryPopout from './CandidateSummaryPopout'
import MatchRemarksPopout from './MatchRemarksPopout'
// K3/K5 (batch 5): the customer bedrijfstekst + department omschrijving popouts
// live under pages/customers/popout (this task's own folder scope), not here —
// this dispatcher only imports them.
import CustomerCompanyTextPopout from '@/pages/customers/popout/CustomerCompanyTextPopout'
import CustomerDepartmentTextPopout from '@/pages/customers/popout/CustomerDepartmentTextPopout'
// V-desc-1: the vacancy description popout lives under pages/vacancies/popout
// (this task's own folder scope), not here — this dispatcher only imports it.
import VacancyDescriptionPopout from '@/pages/vacancies/popout/VacancyDescriptionPopout'

// One entry per supported `<entity>:<field>` pair — keep in sync with
// PopoutTextField / openTextPopout in lib/secondScreen.ts.
const TEXT_POPOUT_PAGES: Record<string, ComponentType<{ id: string | undefined }>> = {
  'candidate:summary': CandidateSummaryPopout,
  'candidate:matchRemarks': MatchRemarksPopout,
  'customer:companyText': CustomerCompanyTextPopout,
  'customer:departmentText': CustomerDepartmentTextPopout,
  'vacancy:description': VacancyDescriptionPopout,
}

export default function TextPopoutPage() {
  const { entity, id, field } = useParams<{ entity: string; id: string; field: string }>()
  const { t } = useTranslation('common')

  const Page = TEXT_POPOUT_PAGES[`${entity}:${field}`]
  // Unknown pair — never a blank screen (§3); reload is the only meaningful
  // "retry" for a malformed URL (there is no request to re-issue).
  if (!Page) {
    return (
      <PopoutShell
        loading={false} error onRetry={() => window.location.reload()}
        loadingLabel="" errorLabel={t('popout.unknownEntity')} retryLabel={t('error.retry')}
        name="" initials="" subtitle=""
      >
        {null}
      </PopoutShell>
    )
  }

  return <Page id={id} />
}
