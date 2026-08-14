/**
 * CustomerStructureReport — "Klantstructuur": Contacts/Locations/Departments share
 * one switch page (RAPPORTEN-CONSOLIDATIE-1, Danny's sidebar-shortening ask). These
 * are three DIFFERENT customer sub-entities — not one entity sliced by population
 * (unlike Instroom's Kandidaten/Leads or Klanten's Klanten/Prospects, which are one
 * `phase` filter on the SAME table) — so this page swaps which full report
 * component renders, mirroring PeopleReport's "different entity, same switch idea"
 * reasoning, not a shared-hook filter. Kept SEPARATE from CustomersReport itself on
 * purpose: stapling a 5-way switch (Klanten/Prospects/Contacts/Locations/Departments)
 * onto one control would mix two different kinds of switching (a population filter
 * vs. a full entity swap) into a single affordance — every worked example Danny gave
 * (SM's uren/diensten, Kandidaten/Leads, Klanten/Prospects) is a same-entity filter
 * pair, so this page stays its own switch, right next to Klanten in the menu.
 * Each position is the EXACT pre-existing report component, unchanged — its own
 * nine KPI cards (independently configurable in Settings, see kpiCatalog.ts), its
 * own axes, its own drill lists.
 */
import { useTranslation } from 'react-i18next'
import ReportSwitchBar from './ReportSwitchBar'
import { useReportSwitch } from './useReportSwitch'
import ContactsReport from './ContactsReport'
import LocationsReport from './LocationsReport'
import DepartmentsReport from './DepartmentsReport'
import type { ReportPeriod } from '@/types/analytics'

// Kept as plain `string` on the wire (see CandidatesReport's identical note) so
// this component satisfies ReportsPage's one shared `ReportComponent` contract.
const VIEWS = ['contacts', 'locations', 'departments'] as const

export default function CustomerStructureReport({ period, initialView = 'contacts' }: {
  period: ReportPeriod
  initialView?: string
}) {
  const { t } = useTranslation('analytics')
  const [view, setView] = useReportSwitch(VIEWS, initialView)

  return (
    <div>
      <ReportSwitchBar ariaLabel={t('customerstructure.viewSwitch.ariaLabel')} value={view} onChange={setView}
        options={[
          { value: 'contacts', label: t('customerstructure.viewSwitch.contacts') },
          { value: 'locations', label: t('customerstructure.viewSwitch.locations') },
          { value: 'departments', label: t('customerstructure.viewSwitch.departments') },
        ]} />
      {view === 'contacts' && <ContactsReport period={period} />}
      {view === 'locations' && <LocationsReport period={period} />}
      {view === 'departments' && <DepartmentsReport period={period} />}
    </div>
  )
}
