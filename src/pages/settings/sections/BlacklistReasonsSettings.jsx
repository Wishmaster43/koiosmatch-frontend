import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
import StatusListEditor from './StatusListEditor'

/**
 * BlacklistReasonsSettings — blacklist-reason lookups for BOTH entities that carry a
 * blacklist deployability status: candidate (candidates.blacklist_reason) and customer
 * (customers.blacklist_reason). Two sub-tabs, one shared StatusListEditor instance
 * each (mirrors CustomerDisplaySettings' SubTabBar pattern) — ONE registry entry for
 * both halves, per the manager's ownership split.
 *
 * Endpoints (backend core-lookups.php, both SimpleLookupController: plain name+colour
 * CRUD, no sort_order/reorder route, delete guarded 409): candidate uses the renamed
 * `/candidate-blacklist-reasons` (the old `/blacklist-reasons` stays only as a
 * temporary FE-migration alias, BLACKLIST-RENAME); customer uses
 * `/customer-blacklist-reasons` (KLANT-BLACKLIST-1).
 * Both lists are reorderable={false}: SimpleLookupController has no /reorder route (audit 04-08).
 */
export default function BlacklistReasonsSettings() {
  const { t } = useTranslation('settings')
  const [activeTab, setActiveTab] = useState('candidate')
  const tabs = [
    { id: 'candidate', label: t('blacklistReasons.tabs.candidate') },
    { id: 'customer', label: t('blacklistReasons.tabs.customer') },
  ]

  return (
    <div style={{ maxWidth: 640 }}>
      <SubTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 14 }}>
        {activeTab === 'candidate' && (
          <StatusListEditor reorderable={false} title={t('blacklistReasons.candidate.title')} subtitle={t('blacklistReasons.candidate.subtitle')}
            endpoint="/candidate-blacklist-reasons" addLabel={t('blacklistReasons.add')} withColor />
        )}
        {activeTab === 'customer' && (
          <StatusListEditor reorderable={false} title={t('blacklistReasons.customer.title')} subtitle={t('blacklistReasons.customer.subtitle')}
            endpoint="/customer-blacklist-reasons" addLabel={t('blacklistReasons.add')} withColor />
        )}
      </div>
    </div>
  )
}
