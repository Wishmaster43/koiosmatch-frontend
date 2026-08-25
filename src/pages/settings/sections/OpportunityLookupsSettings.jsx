/**
 * OpportunityLookupsSettings — the four Kans (opportunity) pipeline lookups, each a
 * separate tenant-configurable list backed by the shared value/label/color/sort_order
 * shape (backend OpportunityStageController + OpportunityLookupController subclasses,
 * routes/api/tenant/opportunities.php): stages, service types, agreement types and
 * deal types. All four reorder by drag (their `reorder` route exists); the typed-rank
 * input (showRank) stays OFF — no other lookup editor shows it (Danny 04-08), drag is
 * the one ordering idiom. FE consumers: useOpportunityStages / useOpportunityLookups.
 *
 * Registry note (registry.jsx:252 already flags this move): stage/service/agreement
 * lookups previously had no editor at all; deal types are new here too. One
 * component, four sub-tabs (SubTabBar, mirrors BlacklistReasonsSettings/
 * CustomerDisplaySettings) — ONE registry entry replaces the `opportunity_display`-
 * only group's placeholder comment.
 *
 * Deal type carries an extra `unit` (euro|hours|quote) driving how the FE measures a
 * deal's value (OpportunityDealType.php) — stage/service/agreement have no such field.
 *
 * Stage also carries `is_won`/`is_lost` terminal flags (OpportunityStage.php) — wired
 * here as `flagFields` (04-08, generalized from StatusListEditor's single flagField)
 * because they have REAL consumers, not a speculative toggle: OpportunitiesInsightsRow
 * derives its won/lost/open KPI counts from `stages.find(s => s.isWon/isLost)`, and
 * OpportunitiesTable's isTerminalStage() gates the expected-close-date column the same
 * way (both via useOpportunityStages/lookupUtils.mapOpportunityLookup). The backend's
 * OpportunityStageController already validates both as plain `sometimes|boolean` with
 * no singleton/exclusivity guard, so both flags toggle freely (modal checkbox + row
 * badge, same as any other flagFields entry — never a DefaultToggle-style singleton).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import StatusListEditor from './StatusListEditor'

export default function OpportunityLookupsSettings() {
  const { t } = useTranslation('settings')
  const [activeTab, setActiveTab] = useState('stages')
  const tabs = [
    { id: 'stages', label: t('opportunityLookups.tabs.stages') },
    { id: 'serviceTypes', label: t('opportunityLookups.tabs.serviceTypes') },
    { id: 'agreementTypes', label: t('opportunityLookups.tabs.agreementTypes') },
    { id: 'dealTypes', label: t('opportunityLookups.tabs.dealTypes') },
  ]

  return (
    <div style={{ maxWidth: 640 }}>
      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 14 }}>
        {activeTab === 'stages' && (
          <StatusListEditor withColor withValueSlug
            title={t('opportunityLookups.stages.title')} subtitle={t('opportunityLookups.stages.subtitle')}
            endpoint="/opportunity-stages" addLabel={t('opportunityLookups.add')}
            // defaultValue: the ns/key pair is reported to the owning lane for the
            // five locale bundles (§5) rather than hand-edited here (out of scope
            // for this task) — the fallback keeps the UI in real English meanwhile.
            flagFields={[
              { key: 'is_won', label: t('opportunityLookups.stages.isWon', { defaultValue: 'Won stage' }),
                description: t('opportunityLookups.stages.isWonHint') },
              { key: 'is_lost', label: t('opportunityLookups.stages.isLost', { defaultValue: 'Lost stage' }),
                description: t('opportunityLookups.stages.isLostHint') },
            ]} />
        )}
        {activeTab === 'serviceTypes' && (
          <StatusListEditor withColor withValueSlug
            title={t('opportunityLookups.serviceTypes.title')} subtitle={t('opportunityLookups.serviceTypes.subtitle')}
            endpoint="/opportunity-service-types" addLabel={t('opportunityLookups.add')} />
        )}
        {activeTab === 'agreementTypes' && (
          <StatusListEditor withColor withValueSlug
            title={t('opportunityLookups.agreementTypes.title')} subtitle={t('opportunityLookups.agreementTypes.subtitle')}
            endpoint="/opportunity-agreement-types" addLabel={t('opportunityLookups.add')} />
        )}
        {activeTab === 'dealTypes' && (
          <StatusListEditor withColor withValueSlug
            title={t('opportunityLookups.dealTypes.title')} subtitle={t('opportunityLookups.dealTypes.subtitle')}
            endpoint="/opportunity-deal-types" addLabel={t('opportunityLookups.add')}
            extraField={{ key: 'unit', label: t('opportunityLookups.dealTypes.unit'), default: 'euro',
              options: [
                { value: 'euro',  label: t('opportunityLookups.dealTypes.unitEuro') },
                { value: 'hours', label: t('opportunityLookups.dealTypes.unitHours') },
                { value: 'quote', label: t('opportunityLookups.dealTypes.unitQuote') },
              ] }} />
        )}
      </div>
    </div>
  )
}
