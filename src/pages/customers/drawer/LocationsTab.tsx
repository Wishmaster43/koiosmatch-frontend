/**
 * LocationsTab — the customer's locations as a searchable table; a row drills into
 * the fully editable LocationDetail (C-6 address fields + status + nested
 * departments/contacts management). "+ Locatie toevoegen" opens the full grouped
 * AddLocationModal (Danny 13/7: the old name+city-only popup was "far too bare").
 *
 * Owns "which location is open" itself (DRILL-PAGER-1, Danny 02-08) instead of
 * delegating to the generic SubEntityTab shell — mirrors ContactsTab/DepartmentsTab,
 * which already dropped SubEntityTab for the same reason (see their own docblocks).
 * The pager needs to step the open id DIRECTLY, without unmounting through the list,
 * which SubEntityTab's private internal selectedId state could not offer from outside.
 */
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Search, Archive } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useAllSettings, useSettingsLoaded, getBoolSetting, getStringSetting } from '@/lib/settings/useAllSettings'
import LocationDetail from './LocationDetail'
import AddLocationModal from '../AddLocationModal'
import type { DrillPagerProps } from '@/components/drawer/DrillPager'
import SoftChipJs from '@/components/ui/SoftChip'
import type { Contact, Department, Location } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { LocationPayload } from '../hooks/useCustomerLocations'
// ARCHIVE-SUBENTITY-1: the archived-only sub-fetch behind the "Gearchiveerd"
// quick-view — a SEPARATE fetch so every OTHER consumer of the live `locations`
// prop (add-modal pickers etc.) keeps seeing today's archived-excluded set.
import { useArchivedCustomerLocations } from '../hooks/useCustomerLocations'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>
// Plain-text fallback style for a coloured column toggled off (CHIPKLEUR-INSTELBAAR-1) —
// mirrors the `plainCell` convention in CandidatesTable/CustomersTable.
const plainCell = { color: 'var(--text)', fontSize: 12 }

// Mirrors SubEntityTab's search box, now owned directly here (see file header).
// TOOLBAR-WIDTH-1 (Danny, live 04-08: "zelfde breedte houden" across Locaties/
// Afdelingen/Contactpersonen) — minWidth 0, not 120: a flex child's implicit
// min-width:auto would otherwise keep this box from shrinking to the SAME
// footprint DepartmentsPanel/ContactsPanel already use, so the three toolbars
// would drift out of lockstep the moment the panel got tight (mirrors the
// ContactsPanel comment this now matches byte-for-byte).
const searchWrap = {
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
} as const
const searchInput = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' } as const

interface Props {
  customerId?: Id
  customerName?: string
  locations?: Location[]
  departments?: Department[]
  contacts?: Contact[]
  statuses?: LookupOption[]
  departmentStatuses?: LookupOption[]
  contactStatuses?: LookupOption[]
  // EXTRACT-1: the caller's own customers.update permission check, threaded down
  // to the Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  onAddLocation: (payload: LocationPayload) => void
  onSaveLocation: (id: Id, payload: Partial<LocationPayload>) => void
  onDeleteLocation: (id: Id) => void
  onAddDepartment: (payload: DepartmentPayload, locationName?: string) => void
  onUpdateDepartment: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemoveDepartment: (id: Id) => void
  // CONTACT-PRIMAIR-LOCATIE-2: widened from `=> void` — the real `useCustomerContacts().add`
  // (threaded in from CustomerDrawer) already resolves with the saved contact row; AddLocationModal
  // needs that id to couple a brand-new typed name as the location's primary contact.
  onAddContact: (payload: ContactPayload) => Promise<Contact | void> | void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  onRemoveContact: (id: Id) => void
}

export default function LocationsTab({
  customerId, customerName, locations = [], departments = [], contacts = [], statuses = [], departmentStatuses = [], contactStatuses = [],
  canLinkBackoffice = false,
  onAddLocation, onSaveLocation, onDeleteLocation, onAddDepartment, onUpdateDepartment, onRemoveDepartment, onAddContact, onUpdateContact,
  onRemoveContact,
}: Props) {
  const { t } = useTranslation('customers')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  // The host owns which location is open (DRILL-PAGER-1, mirrors ContactsTab) — the
  // pager below sets this id directly, so paging never round-trips through the list.
  const [openId, setOpenId] = useState<Id | null>(null)
  // ARCHIVE-SUBENTITY-1: "Gearchiveerd" quick-view — REPLACES the live rows with the
  // archived-only sub-fetch (mutually exclusive lens, same as Blacklist/Archived on
  // candidates), never merged with them. `active` gates the fetch entirely, so
  // toggling it off costs nothing.
  const [showArchived, setShowArchived] = useState(false)
  const { locations: archivedLocations } = useArchivedCustomerLocations(customerId, showArchived)
  const baseRows = showArchived ? archivedLocations : locations
  // Colour-on/off flag for the status column (CHIPKLEUR-INSTELBAAR-1) — defaults ON,
  // so an absent setting keeps today's coloured-chip look.
  const settings = useAllSettings()
  const colorStatusCol = getBoolSetting(settings, 'customer_location_table_color_status', true)
  // Tenant-configured default status filter (TENANT-DEFAULT-1, Danny 02-08) — replaces
  // the old "active only" guess when Settings → Klanten → Tabelweergave → Locaties has
  // one saved; absent (null) falls back to that original guess unchanged. `settingsLoaded`
  // stops the hook from deciding before /settings has actually answered (see its own docblock).
  const settingsLoaded = useSettingsLoaded()
  const defaultStatusFilter = getStringSetting(settings, 'customer_location_default_status_filter')
  const { value: statusFilter, toggle: toggleStatus, filtered: rows } =
    useStatusFilter(baseRows, statuses, undefined, defaultStatusFilter, settingsLoaded)

  // Client-side search over name/city, same behaviour SubEntityTab used to run — the
  // pager below must page through EXACTLY this list, the one the table actually shows.
  const q = search.trim().toLowerCase()
  const visible = q ? rows.filter(l => [l.name, l.city].some(v => String(v ?? '').toLowerCase().includes(q))) : rows

  // Resolved against `baseRows` (live OR archived, whichever view is active), never
  // `visible`: editing a location's status can move it out of the active filter, and
  // the open detail must not vanish.
  const selected = openId != null ? baseRows.find(l => String(l.id) === String(openId)) ?? null : null
  // Pager: 1-based position of the OPEN location within `visible`. No pager at all when
  // the open location fell out of `visible` — nothing sane to page to in that case.
  const openIndex = selected ? visible.findIndex(l => String(l.id) === String(selected.id)) : -1
  const pager: DrillPagerProps | undefined = openIndex >= 0 ? {
    index: openIndex + 1,
    total: visible.length,
    onPrev: openIndex > 0 ? () => setOpenId(visible[openIndex - 1].id as Id) : undefined,
    onNext: openIndex < visible.length - 1 ? () => setOpenId(visible[openIndex + 1].id as Id) : undefined,
  } : undefined

  const columns: Column<Location>[] = [
    { key: 'name', header: t('locations.col.name'), sortable: true, sortValue: l => l.name,
      render: l => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={14} color="var(--color-secondary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{l.name}</span>
        </div>
      ) },
    { key: 'city', header: t('locations.col.city'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: l => l.city, render: l => l.city || '—' },
    { key: 'status', header: t('locations.col.status'), sortable: true, sortValue: l => l.statusLabel,
      render: l => !l.statusLabel ? '—' : colorStatusCol
        ? <SoftChip label={l.statusLabel} color={l.statusColor} />
        : <span style={plainCell}>{l.statusLabel}</span> },
    { key: 'departments', header: t('locations.col.departments'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true,
      sortValue: l => departments.filter(d => String(d.locationId) === String(l.id)).length,
      render: l => departments.filter(d => String(d.locationId) === String(l.id)).length },
    { key: 'contacts', header: t('locations.col.contacts'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true,
      sortValue: l => contacts.filter(c => String(c.locationId) === String(l.id)).length,
      render: l => contacts.filter(c => String(c.locationId) === String(l.id)).length },
  ]

  // ── Detail view: `key` remounts on every id change — paging to another location
  //    must never carry over in-progress edit/sub-tab state from the previous one.
  if (selected) {
    return (
      <LocationDetail
        key={String(selected.id)}
        location={selected} customerId={customerId} customerName={customerName}
        locations={locations.map(x => ({ id: x.id as Id, name: x.name }))}
        departments={departments} contacts={contacts}
        statuses={statuses} departmentStatuses={departmentStatuses} contactStatuses={contactStatuses}
        canLinkBackoffice={canLinkBackoffice} pager={pager}
        onSave={onSaveLocation} onDelete={onDeleteLocation}
        onAddDepartment={onAddDepartment} onUpdateDepartment={onUpdateDepartment} onRemoveDepartment={onRemoveDepartment}
        onAddContact={onAddContact} onUpdateContact={onUpdateContact} onRemoveContact={onRemoveContact}
        backLabel={t('drawer.tabs.locations')}
        // LOCATIE-SAMENVOEGEN-1: after a merge the open record switches to the SURVIVOR
        // (this tab already owns `openId`, so no extra prop threading is needed).
        onMerged={survivorId => setOpenId(survivorId)}
        close={() => setOpenId(null)}
      />
    )
  }

  // ── List view ──
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={searchWrap}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('locations.searchPlaceholder')} aria-label={t('locations.searchPlaceholder')} style={searchInput} />
          </div>
          <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={statuses} />
          {/* ARCHIVE-SUBENTITY-1: the shared quick-view toggle (§4) — never hand-rolled. */}
          <QuickViewToggle iconOnly active={showArchived} onToggle={() => setShowArchived(v => !v)}
            label={t('locations.archivedView')} color="var(--color-archive)" icon={Archive} />
          <DrawerAddButton onClick={() => setAdding(true)} label={t('locations.add')} />
        </div>
        <DataTable columns={columns} rows={visible} onRowClick={l => setOpenId(l.id as Id)} emptyText={t('locations.empty')} />
      </div>
      {adding && (
        // customerId + existingContacts (CONTACT-PRIMAIR-LOCATIE-1) and onAddContact
        // (CONTACT-PRIMAIR-LOCATIE-2) all already live in this component's own props,
        // just never reached the modal — needed so the "contact ter plaatse" picker can
        // offer this customer's real contacts, couple a PICKED one as this new location's
        // primary contact after create, or CREATE a brand-new one first when the typed
        // name matches nobody, then couple that.
        <AddLocationModal customerName={customerName} customerId={customerId} statuses={statuses} existingContacts={contacts}
          onCreate={onAddLocation} onAddContact={onAddContact} onClose={() => setAdding(false)} />
      )}
    </>
  )
}
