/**
 * CustomerSourcesSettings — CUST-SOURCE-FE-1: the tenant acquisition-source
 * list (/customer-sources, e.g. "LinkedIn", "Google", "Website leads") that
 * feeds the customer source picker (AddCustomerModal, OverviewTab — see
 * useCustomerSources) plus the free-entry toggle. A thin config over the
 * shared FreeEntryLookupSettings, mirroring ApplicationSourcesSettings.jsx
 * 1:1 against the customer's own endpoint — see that file's own doc comment
 * for the dedicated-route / underscored-vs-dotted-key reasoning, which
 * applies here unchanged.
 */
import { useCustomerSources } from '@/lib/useCustomerSources'
import FreeEntryLookupSettings from '@/pages/settings/components/FreeEntryLookupSettings'

// No withIcon/withColor: customer_sources has neither column yet on the backend
// (LOOKUP-ICONS-FE-2 round-4 hash, ±19:30 13-09) — revisit once that lands.
export default function CustomerSourcesSettings() {
  return (
    <FreeEntryLookupSettings
      useLookup={useCustomerSources}
      endpoint="/customer-sources"
      i18nPrefix="customerSourcesSettings"
    />
  )
}
