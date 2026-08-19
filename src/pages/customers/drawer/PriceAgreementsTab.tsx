/**
 * PriceAgreementsTab — the customer's price agreements (MATCH-PLC, 2026-07-09):
 * the purchase/sale rates a match should use for a given function/CAO/schaal/
 * trede combination (each optional = wildcard). Add via AddPriceAgreementModal
 * (Danny 03-08: was an inline expanding form, now the house "+" popup like every
 * other entity); each row is a PriceAgreementRow with in-place edit + delete.
 * Handles all four UI states.
 *
 * FACTUURADRES-1 (Danny 2026-08-01): the Facturatie sub-tab also carries the customer's
 * OWN invoice address, next to the billing e-mail and the billing vestiging it belongs
 * with. A main customer may invoice through a PO box, which can never be a vestiging.
 * Leaving the block empty means "use the visit address", so nobody maintains one address
 * twice — while it is empty the block shows the visit address and says it is being used.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Search } from 'lucide-react'
// House "+ action" trigger (Danny 27-07: "+ Prijsafspraak toevoegen moet ook
// knopje zijn!!! zoals in kandidaat drill down") — replaces the bare text button below.
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import Spinner from '@/components/ui/Spinner'
// TOOLBAR-4 (Danny, live 04-08: "ook zoek venster en status!!") — the same shared
// filter trigger every other sub-entity list uses (see its own docblock).
import StatusFilterSelect, { useStatusFilter, STATUS_FILTER_ALL } from '@/components/drawer/StatusFilterSelect'
import { usePriceAgreements } from '../hooks/usePriceAgreements'
import type { PriceAgreement } from '../hooks/usePriceAgreements'
import AddPriceAgreementModal from '../AddPriceAgreementModal'
import { emptyDraft, draftToPayload } from './PriceAgreementForm'
import type { PriceAgreementDraft } from './PriceAgreementForm'
import PriceAgreementRow from './PriceAgreementRow'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { useLocations } from '@/lib/useLocations'
import SubTabBar from '@/components/drawer/SubTabBar'
import { getCountryOptions } from '@/lib/countries'
import { resolveCustomerBillingAddress } from '../hooks/customerBillingAddress'
import { toLocalIsoDate } from '@/lib/localDate'
import { Caption } from '@/components/ui/typography'
import type { Customer } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

// TOOLBAR-4 — the search box's own footprint, byte-identical to every other
// sub-entity list (Locaties/Afdelingen/Contactpersonen/Matches): flex-growing,
// '6px 10px' padding, radius 8, fontSize 12, icon 13.
const searchWrap = {
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
} as const
const searchInput = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' } as const

export default function PriceAgreementsTab({ customerId, c, onSave }: { customerId?: Id; c?: Customer; onSave?: (values: Record<string, unknown>) => void }) {
  const { t, i18n } = useTranslation('customers')
  const { agreements, loading, error, reload, add, update, remove } = usePriceAgreements(customerId)
  // Same establishment list the match form uses, so both offer exactly one source.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  const [adding, setAdding] = useState(false)
  // Danny 28-07: the tab is "Financieel" with two sub-tabs. Price agreements are what an
  // account manager works in daily; the billing settings are set once and then left, so
  // they get their own place instead of sitting on top of the list.
  const [subTab, setSubTab] = useState<'prices' | 'billing'>('prices')
  const [draft, setDraft] = useState<PriceAgreementDraft>(emptyDraft)

  // Submit the add-form, then close it and reset for the next entry.
  const saveNew = () => { add(draftToPayload(draft)); setAdding(false); setDraft(emptyDraft()) }

  // TOOLBAR-4 (Danny, live 04-08: "ook zoek venster en status!!") — a price
  // agreement carries NO status field at all (see usePriceAgreements/PriceAgreement:
  // only function/cao/scale/step/rates/validFrom/validUntil), so there is no tenant
  // lookup to filter on. `validUntil` vs today is the closest honest read of the
  // "active/expired" axis Danny anticipated — DERIVED client-side, never a Settings
  // lookup, never sent to the backend. `STATUS_FILTER_ALL` is passed as the tenant
  // default so this starts showing EVERY row (no silent guess hiding expired ones);
  // the recruiter opts into narrowing, same as every StatusFilterSelect caller can.
  // Local calendar day, never `.toISOString()` — see toLocalIsoDate's doc for the
  // measured UTC-shift bug this fixes.
  const todayIso = toLocalIsoDate(new Date())
  const isExpired = (a: PriceAgreement) => !!a.validUntil && a.validUntil.slice(0, 10) < todayIso
  const derivedStatuses: LookupOption[] = [
    { id: 'active', value: 'active', label: t('priceAgreements.statusActive') },
    { id: 'expired', value: 'expired', label: t('priceAgreements.statusExpired') },
  ]
  const { value: statusFilter, toggle: toggleStatus, filtered: statusFiltered } =
    useStatusFilter(agreements, derivedStatuses, a => (isExpired(a) ? 'expired' : 'active'), STATUS_FILTER_ALL)
  // Free-text search on top of the derived filter — function/CAO/scale, the row's
  // own match criteria (§ MATCH-PLC), same client-side pattern every other list uses.
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const visible = q
    ? statusFiltered.filter(a => [a.functionTitle, a.cao, a.scale].some(v => String(v ?? '').toLowerCase().includes(q)))
    : statusFiltered

  // FACTUURADRES-1 — which address an invoice goes to, resolved client-side so the block
  // flips the instant an optimistic PATCH lands (see the hook for the full reasoning).
  const billing = resolveCustomerBillingAddress(c)
  // The invoice-address table's edit toggle is owned here, because the READ view swaps
  // between two different shapes (the own address vs. the visit-address fallback) and
  // only this component knows which one to show.
  const [editingBillingAddress, setEditingBillingAddress] = useState(false)
  // ISO-2 country codes as VALUES: `billing_country` runs through the backend's
  // CountryCodeCast, which normalises every write to ISO-2 and returns it verbatim
  // (LAND-ISO-1). Sending a country NAME here would store a second vocabulary.
  const countryOptions = getCountryOptions(i18n.language)
  // Loose rows, never the shared 'address' composite: that composite reads the fixed
  // visit-address keys, and an incomplete invoice address must stay visibly incomplete
  // so somebody fixes it rather than hiding behind a composed line. No province row —
  // a Dutch invoice does not carry one, so the column deliberately does not exist.
  const billingAddressFields: FieldRow[] = [
    { key: 'billingPoBox', label: t('overview.billingAddress.poBox') },
    { key: 'billingStreet', label: t('locations.detail.street') },
    { key: 'billingHouseNumber', label: t('locations.detail.houseNumber') },
    { key: 'billingHouseNumberSuffix', label: t('locations.detail.houseNumberSuffix') },
    { key: 'billingPostalCode', label: t('locations.detail.postalCode') },
    { key: 'billingCity', label: t('locations.detail.city') },
    { key: 'billingCountry', label: t('locations.detail.country'), type: 'select', options: countryOptions },
  ]
  // Read view while the block is empty: the visit address, plus the line saying it is
  // the one being used — that is what "empty means use the visit address" looks like.
  const fallbackRow: FieldRow = {
    key: 'billingVisitAddress',
    label: t('overview.address'),
    renderValue: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12, color: billing.visitLine ? 'var(--text)' : 'var(--text-muted)' }}>
          {billing.visitLine || t('overview.billingAddress.visitEmpty')}
        </span>
        <Caption>{t('overview.billingAddress.usesVisitAddress')}</Caption>
      </div>
    ),
  }
  // Save closes the edit cycle here (a controlled EditableFieldTable never closes itself)
  // and hands the raw billing keys to the page's optimistic PATCH.
  const saveBillingAddress = (values: Record<string, unknown>) => { setEditingBillingAddress(false); onSave?.(values) }

  return (
    <div>
      <SubTabBar
        tabs={[
          // K11a (13-08): the count moves INTO the tab label — the section
          // used to repeat "PRIJSAFSPRAKEN <count>" as a second uppercase
          // heading right below this same tab, a dead duplicate of the label
          // above it (same fix pattern as DocumentsTab 05-08).
          { id: 'prices',  label: <>{t('drawer.tabs.priceAgreements')} <span style={{ opacity: 0.6 }}>{agreements.length}</span></> },
          { id: 'billing', label: t('drawer.tabs.billing') },
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {/* Facturatie — kostenplaats is the top of the afdeling>locatie>klant cascade the
          match form reads, and the billing e-mail is the ONE address invoicing uses
          regardless of which location or department a match picks. */}
      {subTab === 'billing' && c && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* CANON-DIVIDER-1 (Danny 05-08): candidate ProfileTab canon — no line
              between rows, 11px labels. */}
          <EditableFieldTable
            title={t('overview.billing')}
            fields={[
              // Which establishment this customer's paperwork/invoicing runs through
              // (BRANCH-1). It sits with the other billing settings rather than on the
              // company tab (Danny 28-07) — it decides where the invoice comes from.
              { key: 'branchId', label: t('overview.branchField'), type: 'select', options: branchOptions },
              { key: 'costCenter',   label: t('overview.costCenter') },
              { key: 'billingEmail', label: t('overview.billingEmail') },
            ]}
            value={c as unknown as Record<string, unknown>}
            onSave={onSave}
          />

          {/* FACTUURADRES-1 — the customer's own invoice address, right where the other
              billing settings live. It edits the RAW columns only: pre-filling the visit
              address into the form would turn "same as visit address" into a frozen copy
              that then drifts, which is exactly what this design avoids. */}
          <div>
            <EditableFieldTable
              title={t('overview.billingAddress.title')}
              fields={billing.own || editingBillingAddress ? billingAddressFields : [fallbackRow]}
              value={billing.fields as unknown as Record<string, unknown>}
              onSave={saveBillingAddress}
              editing={editingBillingAddress}
              onStartEdit={() => setEditingBillingAddress(true)}
              onCancel={() => setEditingBillingAddress(false)}
            />
            {/* Only while editing: the emptying rule is a property of the FORM, and
                repeating it in read mode would just restate the fallback line above. */}
            {editingBillingAddress && (
              // K13a — horizontal padding matches the card rows' '7px 12px' (EditableFieldTable
              // .106/.358) so the hint's left edge lines up with the field labels above it.
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0', padding: '0 12px' }}>
                {t('overview.billingAddress.hint')}
              </p>
            )}
          </div>
        </div>
      )}
      {subTab === 'prices' && (
      <>
      {/* K11a (13-08): the uppercase "PRIJSAFSPRAKEN <count>" heading that used to sit
          here duplicated the sub-tab label directly above it — removed, count now lives
          on the tab itself (see SubTabBar tabs above). */}
      {/* TOOLBAR-4 — house order (Danny, live 04-08): search left, status filter
          middle (derived active/expired, see the const above), "+" trigger last —
          mirrors Locaties/Afdelingen/Contactpersonen/Matches. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px' }}>
        <div style={searchWrap}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('priceAgreements.searchPlaceholder')} aria-label={t('priceAgreements.searchPlaceholder')}
            style={searchInput} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={derivedStatuses} />
        {!adding && (
          // DRAWER-ADD-SHORT-1 (Danny 05-08): short in this drawer sub-tab's toolbar.
          <DrawerAddButton onClick={() => { setDraft(emptyDraft()); setAdding(true) }} label={t('priceAgreements.add')} short />
        )}
      </div>

      {/* House "+" popup (Danny 03-08) — was an inline expanding panel; the form
          and its saveNew() submit logic are unchanged, only the container is. */}
      {adding && (
        <AddPriceAgreementModal draft={draft} onChange={patch => setDraft(d => ({ ...d, ...patch }))}
          onSave={saveNew} onCancel={() => setAdding(false)} saveLabel={t('priceAgreements.add')} />
      )}

      {/* Loading state. */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <Spinner size={13} /> {t('priceAgreements.loading')}
        </div>
      )}

      {/* Error state — never a silent blank screen. */}
      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={13} />
          <span>{t('priceAgreements.loadError')}</span>
          {/* Arrow-wrap: reload now takes an optional AbortSignal (audit r4) — the
              click event must never flow into that parameter. */}
          <button onClick={() => reload()} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--color-primary-text)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('priceAgreements.retry')}</button>
        </div>
      )}

      {/* Empty state — reflects the filtered/searched set, same convention every
          other sub-entity list uses (a filter narrowing to zero shows this too). */}
      {!loading && !error && visible.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('priceAgreements.empty')}</div>
      )}

      {/* Success state — the list. */}
      {!loading && !error && visible.map(a => (
        <PriceAgreementRow key={String(a.id)} agreement={a} onSave={update} onDelete={remove} />
      ))}
      </>
      )}
    </div>
  )
}
