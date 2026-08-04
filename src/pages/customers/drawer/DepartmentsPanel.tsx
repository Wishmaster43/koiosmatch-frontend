/**
 * DepartmentsPanel — THE department surface of the customer drawer. One component for
 * both scopes: the customer's own Afdelingen tab and a location's nested department
 * list. Before this there were two hand-rolled variants (a real DataTable-backed tab and
 * a bordered row list with pencil/bin buttons and NO drill-in) — Danny 28-07: "wat je nu
 * aan het doen bent voor de contactpersonen moet je ook nog doen voor de afdelingen op
 * een locatie". Same columns, same chips, same actions, same drill-down, everywhere.
 *
 * IT NEVER NAVIGATES. Clicking a row swaps THIS panel's body from the list to
 * DepartmentDetail. The host stays mounted, so a location keeps its position and its
 * in-progress edits — mirrors ContactsPanel's fix for exactly the same class of bug.
 *
 * MEMBERSHIP LIVES HERE, ONCE. The panel always receives the customer-wide department
 * list and narrows it itself, so the "does this department belong to location X" rule
 * exists in one place instead of two copies drifting apart.
 *
 * BREADCRUMB — ONE nav, not two. Unlike ContactDetail (which renders no breadcrumb of
 * its own — ContactsPanel draws it), DepartmentDetail ALREADY renders its own
 * DrillBreadcrumb internally from the `trail` this panel hands it. If this panel also
 * rendered a DrillBreadcrumb of its own around it, two navs would stack —
 * the exact double-breadcrumb trap the contact refactor fixed. So this panel does NOT
 * draw a trail of its own; it passes the ancestors down and DepartmentDetail renders the
 * one nav. (ContactsPanel is the mirror image — ContactDetail draws none, so the panel
 * owns it there. Two components, one rule: exactly one breadcrumb on screen.)
 *
 * A department always has exactly one location (location_id is required on create) — so,
 * unlike a contact, it can never be "uncoupled" to none; there is no couple/uncouple
 * action here, only move (via the detail's own location picker).
 */
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Building, Archive } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { DEPARTMENTS_CHANGED_EVENT } from '../hooks/useCustomerDepartments'
// ARCHIVE-SUBENTITY-1: the archived-only sub-fetch behind the "Gearchiveerd"
// quick-view — a SEPARATE fetch so every OTHER consumer of the live `departments`
// prop (add-modal pickers etc.) keeps seeing today's archived-excluded set.
import { useArchivedCustomerDepartments } from '../hooks/useCustomerDepartments'
import { useChipColors } from '@/lib/settings/useChipColors'
import { useAllSettings, useSettingsLoaded, getBoolSetting, getStringSetting } from '@/lib/settings/useAllSettings'
import type { Crumb } from '@/components/drawer/DrillBreadcrumb'
import SoftChipJs from '@/components/ui/SoftChip'
import DepartmentDetail from './DepartmentDetail'
import type { DrillPagerProps } from '@/components/drawer/DrillPager'
import AddDepartmentModal from '../AddDepartmentModal'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>
const muted = { color: 'var(--text-muted)', fontSize: 12 }
// Plain-text fallback style for a coloured column toggled off (CHIPKLEUR-INSTELBAAR-1) —
// mirrors the `plainCell` convention in CandidatesTable/CustomersTable.
const plainCell = { color: 'var(--text)', fontSize: 12 }

const searchWrap = {
  // minWidth 0: a flex child's implicit min-width:auto would keep the input's ~170px
  // intrinsic width and push the add button off the 548px panel (Danny 03-08:
  // "+ nieuwe contactpersoon valt nog steeds een beetje weg") — search yields instead.
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
} as const
const searchInput = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' } as const

export type DepartmentScope = 'customer' | 'location'

interface Props {
  /** ALWAYS the customer-wide list — the panel narrows it per scope itself. */
  departments: Department[]
  scope: DepartmentScope
  /** The location we are inside, for the scope filter and the add-modal pre-select. */
  scopeId?: Id
  scopeName?: string
  // Point 1 (Danny's ten-point round): threaded down to DepartmentDetail's own
  // ScopedVacanciesTab/ScopedMatchesTab "+" wiring — this panel doesn't use them
  // itself, only passes them through to the opened department.
  customerId?: Id
  customerName?: string
  locations: { id: Id; name: string }[]
  /** Customer-wide contacts — powers the contact-count column and DepartmentDetail's own Contactpersonen sub-tab. */
  contacts: Contact[]
  statuses: LookupOption[]
  contactStatuses?: LookupOption[]
  canLinkBackoffice?: boolean
  /**
   * Which department is open — CONTROLLED by the host, same contract as ContactsPanel:
   * the host must know too, since it hides its own title/sub-tabs while a department is open.
   */
  openId: Id | null
  onOpenChange: (id: Id | null) => void
  /** The crumbs ABOVE this list; passed down so the detail renders one full trail. */
  trail?: Crumb[]
  onAdd: (payload: DepartmentPayload, locationName?: string) => void
  onUpdate: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemove: (id: Id) => void
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  onRemoveContact: (id: Id) => void
}

export default function DepartmentsPanel({
  departments, scope, scopeId, scopeName, customerId, customerName, locations, contacts, statuses,
  contactStatuses = [], canLinkBackoffice = false, openId, onOpenChange, trail = [],
  onAdd, onUpdate, onRemove, onAddContact, onUpdateContact, onRemoveContact,
}: Props) {
  const { t } = useTranslation('customers')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  // ARCHIVE-SUBENTITY-1: "Gearchiveerd" quick-view — REPLACES the live rows with the
  // archived-only sub-fetch (mutually exclusive lens); `active` gates the fetch
  // entirely, so toggling it off costs nothing.
  const [showArchived, setShowArchived] = useState(false)
  const { departments: archivedDepartments } = useArchivedCustomerDepartments(customerId, showArchived)
  const baseDepartments = showArchived ? archivedDepartments : departments

  // THE membership rule, in one place. A department always carries a single locationId.
  const inScope = (d: Department) => scope === 'location' ? String(d.locationId) === String(scopeId) : true
  const scoped = baseDepartments.filter(inScope)
  const chipColors = useChipColors()
  // Colour-on/off flags per column (CHIPKLEUR-INSTELBAAR-1) — both default ON, so an
  // absent setting keeps today's coloured-chip look.
  const settings = useAllSettings()
  const colorLocationCol = getBoolSetting(settings, 'customer_department_table_color_location', true)
  const colorStatusCol = getBoolSetting(settings, 'customer_department_table_color_status', true)
  // Tenant-configured default status filter (TENANT-DEFAULT-1, Danny 02-08) — replaces
  // the old "active only" guess when Settings → Klanten → Tabelweergave → Afdelingen has
  // one saved; absent (null) falls back to that original guess unchanged. `settingsLoaded`
  // stops the hook from deciding before /settings has actually answered (see its own docblock).
  const settingsLoaded = useSettingsLoaded()
  const defaultStatusFilter = getStringSetting(settings, 'customer_department_default_status_filter')
  // Status filter (Danny 28-07) — same component and same defaulting rule on all three lists.
  const { value: statusFilter, toggle: toggleStatus, filtered: rows } =
    useStatusFilter(scoped, statuses, undefined, defaultStatusFilter, settingsLoaded)
  // Resolved against `baseDepartments` (live OR archived, whichever view is active),
  // never the scoped rows: moving a department to another location must not make its
  // open detail vanish mid-edit.
  const selected = openId != null ? baseDepartments.find(d => String(d.id) === String(openId)) ?? null : null

  // Columns are IDENTICAL to the customer tab's, minus the Locatie column inside a
  // location — it would repeat on every row there (mirrors ContactsPanel's own rule).
  const columns: Column<Department>[] = [
    { key: 'name', header: t('departments.col.name'), sortable: true, sortValue: d => d.name,
      render: d => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building size={14} color="var(--color-violet)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{d.name}</span>
        </div>
      ) },
    ...(scope === 'customer' ? [{
      key: 'location', header: t('departments.col.location'), sortable: true, sortValue: (d: Department) => d.locationName,
      // Same tenant-configurable colour the contact list uses for its Locatie chips.
      render: (d: Department) => !d.locationName ? '—' : colorLocationCol
        ? <SoftChip label={d.locationName} color={chipColors.location} />
        : <span style={plainCell}>{d.locationName}</span>,
    }] : []),
    { key: 'status', header: t('departments.col.status'), sortable: true, sortValue: d => d.statusLabel,
      render: d => !d.statusLabel ? '—' : colorStatusCol
        ? <SoftChip label={d.statusLabel} color={d.statusColor} />
        : <span style={plainCell}>{d.statusLabel}</span> },
    { key: 'contacts', header: t('departments.col.contacts'), align: 'right', cellStyle: muted, sortable: true,
      sortValue: d => contacts.filter(c => String(c.departmentId) === String(d.id)).length,
      render: d => contacts.filter(c => String(c.departmentId) === String(d.id)).length },
  ]

  // Client-side search — computed ahead of the detail branch so the pager steps through
  // EXACTLY the rows the table renders, never a wider set (DRILL-PAGER-1, mirrors
  // ContactsPanel verbatim).
  const q = search.trim().toLowerCase()
  const visible = q ? rows.filter(d => [d.name, d.locationName].some(v => String(v ?? '').toLowerCase().includes(q))) : rows
  // Pager: 1-based position of the OPEN department within `visible`; none when the open
  // record fell out of the filtered set — nothing sane to page to then.
  const openIndex = selected ? visible.findIndex(d => String(d.id) === String(selected.id)) : -1
  const pager: DrillPagerProps | undefined = openIndex >= 0 ? {
    index: openIndex + 1,
    total: visible.length,
    onPrev: openIndex > 0 ? () => onOpenChange(visible[openIndex - 1].id as Id) : undefined,
    onNext: openIndex < visible.length - 1 ? () => onOpenChange(visible[openIndex + 1].id as Id) : undefined,
  } : undefined

  // ── Detail view: DepartmentDetail draws the breadcrumb itself (exactly ONE nav on
  //    screen), from the ancestors this panel hands it plus its own list crumb — so every
  //    hop stays independently clickable instead of one folded label.
  if (selected) {
    const listLabel = scope === 'customer' ? t('drawer.tabs.departments') : (scopeName ?? t('drawer.tabs.departments'))
    const detailTrail = [...trail, { label: listLabel, onClick: () => onOpenChange(null) }]
    // key: remount per id so paging never bleeds one record's edit state onto the next.
    return (
      <DepartmentDetail key={String(selected.id)} department={selected} locations={locations} statuses={statuses}
        contacts={contacts.filter(c => String(c.departmentId) === String(selected.id))}
        customerId={customerId} customerName={customerName}
        canLinkBackoffice={canLinkBackoffice} departments={departments} contactStatuses={contactStatuses}
        trail={detailTrail} pager={pager}
        // AFDELING-SAMENVOEGEN-1: after a merge the open record switches to the SURVIVOR
        // (this panel already owns `openId`, mirrors ContactsPanel's identical contact-merge wiring).
        onMerged={survivorId => onOpenChange(survivorId)}
        onAddContact={onAddContact} onUpdateContact={onUpdateContact} onRemoveContact={onRemoveContact}
        onSave={onUpdate} onDelete={onRemove} close={() => onOpenChange(null)} />
    )
  }

  // ── List view ──

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={searchWrap}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('departments.searchPlaceholder')} aria-label={t('departments.searchPlaceholder')} style={searchInput} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={statuses} />
        {/* ARCHIVE-SUBENTITY-1: the shared quick-view toggle (§4) — never hand-rolled. */}
        <QuickViewToggle iconOnly active={showArchived} onToggle={() => setShowArchived(v => !v)}
          label={t('departments.archivedView')} color="var(--color-archive)" icon={Archive} />
        <DrawerAddButton onClick={() => setAdding(true)} label={t('departments.add')} />
      </div>

      {/* Horizontal scroll owned here, same as ContactsPanel — neither DataTable nor the
          drawer shell wraps the table. */}
      <div style={{ overflowX: 'auto' }}>
        <DataTable columns={columns} rows={visible} onRowClick={d => onOpenChange(d.id as Id)} emptyText={t('departments.empty')} />
      </div>

      {adding && (
        <AddDepartmentModal locations={locations} statuses={statuses}
          lockLocationId={scope === 'location' ? scopeId : undefined}
          customerName={scope === 'location' ? scopeName : undefined}
          onCreate={payload => onAdd(payload, locations.find(l => String(l.id) === String(payload.locationId))?.name)}
          // An import creates any number of rows at once, so there is nothing to prepend
          // optimistically — the list simply reloads. Without this the modal closed over
          // records that were already created and the table behind it stayed stale.
          onImported={() => window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT))}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
