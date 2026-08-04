import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import StatusListEditor from './StatusListEditor'

/**
 * OpportunityLookupsSettings — the four Kans (opportunity) pipeline lookups, each a
 * separate tenant-configurable list backed by the shared value/label/color/sort_order
 * shape (backend OpportunityStageController + OpportunityLookupController subclasses,
 * routes/api/tenant/opportunities.php): stages, service types, agreement types and
 * deal types. All four support reorder (their `reorder` route exists) so `showRank`
 * is on for all. FE consumers: useOpportunityStages / useOpportunityLookups.
 *
 * Registry note (registry.jsx:252 already flags this move): stage/service/agreement
 * lookups previously had no editor at all; deal types are new here too. One
 * component, four sub-tabs (SubTabBar, mirrors BlacklistReasonsSettings/
 * CustomerDisplaySettings) — ONE registry entry replaces the `opportunity_display`-
 * only group's placeholder comment.
 *
 * Deal type carries an extra `unit` (euro|hours|quote) driving how the FE measures a
 * deal's value (OpportunityDealType.php) — stage/service/agreement have no such field.
 * Stage also carries `is_won`/`is_lost` terminal flags on the backend, but those are
 * NOT exposed here (out of scope for this pass — a stage's name/colour/order only);
 * flagging the gap rather than inventing UI for it.
 */
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
          <StatusListEditor showRank withColor withValueSlug
            title={t('opportunityLookups.stages.title')} subtitle={t('opportunityLookups.stages.subtitle')}
            endpoint="/opportunity-stages" addLabel={t('opportunityLookups.add')} />
        )}
        {activeTab === 'serviceTypes' && (
          <StatusListEditor showRank withColor withValueSlug
            title={t('opportunityLookups.serviceTypes.title')} subtitle={t('opportunityLookups.serviceTypes.subtitle')}
            endpoint="/opportunity-service-types" addLabel={t('opportunityLookups.add')} />
        )}
        {activeTab === 'agreementTypes' && (
          <StatusListEditor showRank withColor withValueSlug
            title={t('opportunityLookups.agreementTypes.title')} subtitle={t('opportunityLookups.agreementTypes.subtitle')}
            endpoint="/opportunity-agreement-types" addLabel={t('opportunityLookups.add')} />
        )}
        {activeTab === 'dealTypes' && (
          <StatusListEditor showRank withColor withValueSlug
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
