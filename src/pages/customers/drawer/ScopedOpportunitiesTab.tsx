/**
 * ScopedOpportunitiesTab — the department/location/contact "Kansen" sub-tab
 * (SCOPED-LIST-TAB-1). Thin adapter over the shared ScopedListTab: picks the
 * right scope param and reuses the customer-level OpportunitiesTab's own row
 * mapper (mapOpportunity) — never a forked shape. Columns mirror the three
 * most informative fields OpportunitiesTab shows (title/stage/value); expected
 * close and owner are left off, same "stays at three columns" precedent
 * ScopedMatchesTab's own docblock cites for ScopedVacanciesTab. Rows are
 * READ-ONLY: a row opens the real opportunity in its own drawer, mirroring
 * every other scoped list.
 *
 * CONTACT SCOPE: OpportunityQuery validates `contact_id` as an ARRAY filter
 * (mirrors `customer_id[]` — see useCustomerDrawerData's useCustomerOpportunities),
 * but useScopedEntityList only ever sends ONE bare id per param. The array shape
 * is produced here by naming the PARAM KEY itself `contact_id[]`: axios then
 * emits `contact_id[]=<id>` verbatim (a scalar value under a bracketed key),
 * which is the exact querystring shape Laravel parses into a one-element array
 * — verified against axios's own serialiser, not assumed.
 *
 * STAGE FILTER: useOpportunityStages' options carry a real lookup `id` (via
 * normalizeOptions) alongside the stable `value` slug — but an Opportunity row
 * only ever carries `stageValue` (StatusFilterSelect's own docblock: "Opportunity
 * rows carry no stage id at all"). ScopedListTab's internal StatusFilterSelect
 * has no optionKey override, so handing `stages` through as-is would key filter
 * options on `id` while `statusOf` compares against `stageValue` — a silent
 * zero-match filter. Stripping `id` here (mirroring MatchStatus, which never
 * carries one — see useMatchStatuses) makes the shared default optionKey
 * (`s.id ?? s.value`) fall back to `.value`, matching `statusOf` exactly.
 *
 * ADD: AddOpportunityModal only prefills the CUSTOMER (`defaultCustomerId`) — its
 * location/department/contact cascade pickers have no "initial" props at all
 * (unlike MatchModal/AddVacancyModal), only ever resolved from `existing` in
 * EDIT mode. So "+ Kans" here only locks the customer; the location/department/
 * contact still need picking by hand — a real, flagged gap (§3: the customer
 * prefill itself is real, so this is not a fake affordance, just an incomplete
 * one). This component's own props (mirrors ScopedMatchesTab: scope/id/
 * customerId, no customerName) also mean the modal's customer-picker OPTION
 * label is blank until the tenant's real name resolves elsewhere — cosmetic
 * only, the underlying id stays correctly locked.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import EntityLink from '@/components/ui/EntityLink'
import SoftChip from '@/components/ui/SoftChip'
import { useNavigation } from '@/context/NavigationContext'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import AddOpportunityModal from '@/pages/opportunities/AddOpportunityModal'
import { mapOpportunity } from '@/pages/opportunities/data/mapOpportunity'
import ScopedListTab from './ScopedListTab'
import type { ApiOpportunity, Opportunity } from '@/types/opportunity'
import type { Id, LookupOption } from '@/types/common'
import type { Column } from '@/components/ui/DataTable'

// Locale-aware EUR formatter — mirrors OpportunitiesTab's own (not exported there).
const money = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Reuse the customer-level Kansen tab's own mapper verbatim — never a forked shape.
const mapRow = (raw: Record<string, unknown>): Opportunity => mapOpportunity(raw as ApiOpportunity)

export default function ScopedOpportunitiesTab({ scope, id, customerId }: {
  scope: 'department' | 'location' | 'contact'; id: Id | undefined
  // Threaded down from LocationDetail/DepartmentDetail (mirrors ScopedMatchesTab)
  // so "+ Kans" can prefill the customer even though this tab itself only ever
  // asked for `id`.
  customerId?: Id
}) {
  const { t } = useTranslation('customers')
  const { openEntity } = useNavigation()
  const { stages } = useOpportunityStages()
  const queryClient = useQueryClient()
  const paramName = scope === 'department' ? 'customer_department_id'
    : scope === 'location' ? 'customer_location_id'
    // CONTACT SCOPE (see file header): the literal `[]` lives in the param KEY,
    // not the value — that is what makes OpportunityQuery see an array.
    : 'contact_id[]'
  const [adding, setAdding] = useState(false)

  // STAGE FILTER (see file header): strip the lookup `id` so the shared filter's
  // default optionKey falls back to `.value`, matching this row's `stageValue`.
  const stageOptions: LookupOption[] = stages.map(s => ({ value: s.value, label: s.label, color: s.color }))

  const columns: Column<Opportunity>[] = [
    { key: 'title', header: t('opportunities.col.title'), sortable: true, sortValue: o => o.title,
      render: o => <EntityLink page="opportunities" id={o.id}>{o.title}</EntityLink> },
    { key: 'stage', header: t('opportunities.col.stage'), sortable: true, sortValue: o => o.stage,
      render: o => o.stage ? <SoftChip label={o.stage} color={o.stageColor} /> : '—' },
    { key: 'value', header: t('opportunities.col.value'), align: 'right', sortable: true, sortValue: o => o.value ?? -1,
      cellStyle: { color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' },
      render: o => o.value != null ? money.format(o.value) : '—' },
  ]

  return (
    <>
      <ScopedListTab<Opportunity>
        queryKey={`${scope}-opportunities`} endpoint="/opportunities" paramName={paramName} id={id}
        mapRow={mapRow} columns={columns} searchKeys={['title']}
        searchPlaceholder={t('common:search')} loadingText={t('page.loading')}
        emptyText={t('scopedList.opportunitiesEmpty')} errorText={t('scopedList.loadError')}
        onRowClick={o => o.id != null && openEntity('opportunities', o.id)}
        // Only offered once the caller actually knows the customer — otherwise
        // the modal would have nothing to prefill (§3, no fake affordance).
        onAdd={customerId ? () => setAdding(true) : undefined}
        addLabel={t('opportunities.newOpportunity')}
        statuses={stageOptions}
        statusOf={o => String(o.stageValue ?? '')}
      />
      {adding && customerId != null && (
        <AddOpportunityModal
          defaultCustomerId={customerId} customers={[{ id: customerId, name: '' }]}
          onCreated={() => queryClient.invalidateQueries({ queryKey: [`${scope}-opportunities`, '/opportunities', paramName, id] })}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}
