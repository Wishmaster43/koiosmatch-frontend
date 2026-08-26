/**
 * ContactsPanel — THE contact-person surface of the customer drawer. One component for
 * all three scopes: the customer's own Contactpersonen tab, a location's contact list and
 * a department's. Before this there were three hand-rolled variants (a full table, a
 * bordered row list and a bare SectionCard list) that agreed on nothing — Danny 28-07,
 * translated: "the contact-persons tab on location and department doesn't match the
 * main customer's" — verbatim: "het contactpersonen tabblad op locatie en afdeling
 * komt niet overeen met dat van de hoofdklant". Same columns, same chips, same
 * actions, same drill-down, everywhere.
 *
 * IT NEVER NAVIGATES. Clicking a row swaps THIS panel's body from the list to
 * ContactDetail and shows the shared breadcrumb trail. The host stays mounted, so a
 * location keeps its position, its sub-tab and its in-progress edits — the whole point of
 * Danny's report, translated: "if you then click back you're out of the location
 * or department???" — verbatim: "als je dan terug klikt ben je uit de vestiging
 * of afdeling???". The
 * old fix routed the click through the drawer's MAIN tab, which unmounted the locations
 * tab and destroyed exactly that state.
 *
 * MEMBERSHIP LIVES HERE, ONCE. The panel always receives the customer-wide contact list
 * and narrows it itself, so the "does this contact belong to X" rule exists in one place
 * instead of the three copies that were drifting apart.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Link2, Archive } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import type { Crumb } from '@/components/drawer/DrillBreadcrumb'
import { useAllSettings, useSettingsLoaded, getStringSetting } from '@/lib/settings/useAllSettings'
import ContactDetail from './ContactDetail'
import ContactLinkPicker from './ContactLinkPicker'
import AddContactPersonModal from '../AddContactPersonModal'
// Column definitions (chips, last-contact icon, primary star, uncouple) live in their
// own hook — extracted so this file stays the thin list/detail assembler (§3 split).
import { useContactsPanelColumns } from './ContactsPanelColumns'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
// ARCHIVE-SUBENTITY-1: the archived-only sub-fetch behind the "Gearchiveerd"
// quick-view — a SEPARATE fetch so every OTHER consumer of the live `contacts`
// prop (couple pickers etc.) keeps seeing today's archived-excluded set.
import { useArchivedCustomerContacts } from '../hooks/useCustomerContacts'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { DrillPagerProps } from '@/components/drawer/DrillPager'

const searchWrap = {
  // minWidth 0: a flex child's implicit min-width:auto would keep the input's ~170px
  // intrinsic width and push the add button off the 548px panel (Danny 03-08,
  // translated: "+ new contact person still gets cut off a bit" — verbatim: "+ nieuwe
  // contactpersoon valt nog steeds een beetje weg") — search yields instead.
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px',
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
} as const
const searchInput = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' } as const

export type ContactScope = 'customer' | 'location' | 'department'

interface Props {
  /** ALWAYS the customer-wide list — the panel narrows it per scope itself. */
  contacts: Contact[]
  scope: ContactScope
  /** The record we are inside, for the scope filter, the back label and the couple action. */
  scopeId?: Id
  scopeName?: string
  /** ARCHIVE-SUBENTITY-1: the owning customer, for the "Gearchiveerd" quick-view's own
   * fetch. Optional (not every host threads it yet) — falls back to a live contact's
   * own `customerId` when absent, which covers every host today. */
  customerId?: Id
  locations: { id: Id; name: string }[]
  departments: Department[]
  statuses: LookupOption[]
  canLinkBackoffice?: boolean
  /**
   * Which contact is open — CONTROLLED by the host. The host owns it because it must know
   * too: while a contact is open a location hides its own title, sub-tab bar and delete
   * button. Letting this panel own it and call back would mean setting a parent's state
   * during render, which React rightly refuses.
   */
  openId: Id | null
  onOpenChange: (id: Id | null) => void
  /** The crumbs ABOVE this list; the panel appends its own list crumb and the contact. */
  trail?: Crumb[]
  onAdd: (payload: ContactPayload) => void
  onUpdate: (id: Id, payload: Partial<ContactPayload>) => void
  onRemove: (id: Id) => void
}

// The one contact-person surface for all three scopes
// clicking a row swaps this panel's own body instead of navigating away.
export default function ContactsPanel({
  contacts, scope, scopeId, scopeName, customerId, locations, departments, statuses,
  canLinkBackoffice = false, openId, onOpenChange, trail = [], onAdd, onUpdate, onRemove,
}: Props) {
  const { t } = useTranslation('customers')
  // ARCHIVE-SUBENTITY-1: the fetch needs a real customerId; fall back to a live row's
  // own `customerId` when the host has not threaded the prop explicitly yet.
  const effectiveCustomerId = customerId ?? contacts.find(c => c.customerId != null)?.customerId ?? undefined
  // "Gearchiveerd" quick-view — REPLACES the live rows with the archived-only
  // sub-fetch (mutually exclusive lens); `active` gates the fetch entirely.
  const [showArchived, setShowArchived] = useState(false)
  const { contacts: archivedContacts } = useArchivedCustomerContacts(effectiveCustomerId, showArchived)
  const baseContacts = showArchived ? archivedContacts : contacts
  // Tenant-configured default status filter (TENANT-DEFAULT-1, Danny 02-08) — replaces
  // the old "active only" guess when Settings → Customers → Table view → Contact persons
  // has one saved; absent (null) falls back to that original guess unchanged. `settingsLoaded`
  // stops the hook from deciding before /settings has actually answered (see its own docblock).
  const settingsLoaded = useSettingsLoaded()
  const settings = useAllSettings()
  const defaultStatusFilter = getStringSetting(settings, 'customer_contact_default_status_filter')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'couple' | Contact | null>(null)

  // The per-site primary only exists INSIDE a location. A department has no such flag on
  // the backend and the customer axis is a different field entirely, so the whole control
  // is absent elsewhere rather than disabled — there is nothing to write there.
  const locationScope = scope === 'location' && scopeId != null

  // THE membership rule, in one place. A location/department scope reads the singular
  // link id, which is what the frontend actually writes (CONTACT-MULTI-1's arrays exist
  // on the backend but this app never sends them — measured 28-07).
  // Array OR singular — never one of the two. CONTACT-MULTI-1 lets a contact serve
  // several sites, but the pivots are near-empty today (measured 28-07: 1 and 0 rows
  // after a fresh reseed, because the seeder writes the singular columns directly), so
  // scoping on the arrays alone would empty every list; scoping on the singular alone
  // would hide every extra coupling the moment someone adds one.
  const inScope = (c: Contact) => {
    if (scope === 'customer') return true
    const list = scope === 'location' ? c.locations : c.departments
    const single = scope === 'location' ? c.locationId : c.departmentId
    return list.some(x => String(x.id) === String(scopeId)) || String(single) === String(scopeId)
  }
  const scoped = baseContacts.filter(inScope)
  // Status filter (Danny 28-07) — same component and same defaulting rule on all three lists.
  const { value: statusFilter, toggle: toggleStatus, filtered: rows } =
    useStatusFilter(scoped, statuses, undefined, defaultStatusFilter, settingsLoaded)
  // Resolved against `baseContacts` (live OR archived, whichever view is active), never
  // the scoped rows: editing a contact's location moves it out of this scope, and the
  // open detail must not vanish mid-edit.
  const selected = openId != null ? baseContacts.find(c => String(c.id) === String(openId)) ?? null : null

  // Client-side search — same rows the table below actually renders. Computed here
  // (ahead of the detail branch) so the pager below can step through EXACTLY what the
  // user was looking at, never a wider or unfiltered set (DRILL-PAGER-1, Danny 02-08).
  const q = search.trim().toLowerCase()
  const visible = q
    ? rows.filter(c => [c.name, c.role, c.email, c.mobile].some(v => String(v ?? '').toLowerCase().includes(q)))
    : rows
  // Pager: 1-based position of the OPEN contact within `visible`. No pager at all when
  // the open contact fell out of `visible` (e.g. an edit changed its status while the
  // status filter is active) — there is nothing sane to page to in that case.
  const openIndex = selected ? visible.findIndex(c => String(c.id) === String(selected.id)) : -1
  const pager: DrillPagerProps | undefined = openIndex >= 0 ? {
    index: openIndex + 1,
    total: visible.length,
    onPrev: openIndex > 0 ? () => onOpenChange(visible[openIndex - 1].id as Id) : undefined,
    onNext: openIndex < visible.length - 1 ? () => onOpenChange(visible[openIndex + 1].id as Id) : undefined,
  } : undefined

  // Columns (chips, last-contact icon, primary star, uncouple) — extracted to their own
  // hook (ContactsPanelColumns.tsx) so this file stays the thin list/detail assembler.
  const columns = useContactsPanelColumns({ scope, scopeId, locationScope, locations, departments, onUpdate })

  // ── Detail view: this panel's own drill-down. The host hides its chrome (see above),
  //    so there is exactly one title, one back button and one delete button on screen.
  if (selected) {
    // One trail, however deep: the host's ancestors + this list + the open contact.
    const listCrumb: Crumb = {
      label: scope === 'customer' ? t('drawer.tabs.contacts') : (scopeName ?? t('drawer.tabs.contacts')),
      onClick: () => onOpenChange(null),
    }
    return (
      <div>
        <DrillBreadcrumb trail={[...trail, listCrumb]} current={selected.name} />
        {/* `key` remounts on every id change — paging to another contact (or a merge
            survivor swap, see onMerged below) must never carry over in-progress edit
            state (editing/subTab/etc.) from the previous record onto the new one. This
            mirrors what already happened before: the only way to open a DIFFERENT
            contact used to be closing back to the list (which unmounts) and reopening. */}
        <ContactDetail key={String(selected.id)} contact={selected} locations={locations} departments={departments} statuses={statuses}
          existing={contacts} canLinkBackoffice={canLinkBackoffice} pager={pager}
          onSave={onUpdate} onDelete={onRemove} close={() => onOpenChange(null)}
          onMerged={survivorId => onOpenChange(survivorId)} />
      </div>
    )
  }

  // ── List view ──
  // Couple candidates: everyone NOT already in this scope.
  const candidates = contacts.filter(c => !inScope(c))
  const coupleNote = scope === 'location' ? t('locations.detail.coupleNote') : t('departments.detail.coupleNote')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={searchWrap}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('contacts.searchHere')} aria-label={t('contacts.searchHere')} style={searchInput} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={statuses} />
        {/* ARCHIVE-SUBENTITY-1: the shared quick-view toggle (§4) — never hand-rolled. */}
        <QuickViewToggle iconOnly active={showArchived} onToggle={() => setShowArchived(v => !v)}
          label={t('contacts.archivedView')} color="var(--color-archive)" icon={Archive} />
        {/* Coupling only exists inside a scope; at customer level a contact is already "here".
            Icon-only (Danny 03-08): with search + filter + two buttons the scoped row
            overflowed and clipped the primary add button — the SECONDARY action gives up
            its text (kept as title/aria-label), the primary "+ contactpersoon" never does. */}
        {scope !== 'customer' && (
          <DrawerAddButton onClick={() => setModal('couple')} icon={Link2} iconOnly
            label={t(scope === 'location' ? 'locations.detail.coupleAction' : 'departments.detail.coupleAction')} />
        )}
        {/* DRAWER-ADD-SHORT-1 (Danny 05-08): short in this drawer sub-tab's toolbar —
            the couple button above stays icon-only/full (a link action, not "new"). */}
        <DrawerAddButton onClick={() => setModal('add')} label={t('contacts.add')} short />
      </div>

      {/* Horizontal scroll owned here: neither DataTable nor the drawer shell wraps the
          table, and the panel clips at 548px — without this the right-hand columns would
          be silently cut off instead of reachable. */}
      <div style={{ overflowX: 'auto' }}>
        <DataTable columns={columns} rows={visible} onRowClick={c => onOpenChange(c.id as Id)} emptyText={t('contacts.empty')} />
      </div>

      {modal === 'couple' && (
        <ContactLinkPicker candidates={candidates} locations={locations} departments={departments} note={coupleNote}
          onClose={() => setModal(null)}
          onPick={id => { onUpdate(id, scope === 'location' ? { locationId: scopeId ?? null } : { departmentId: scopeId ?? null }); setModal(null) }} />
      )}
      {/* `existing` powers the duplicate check and the primary-replace question — both are
          scoped per CUSTOMER on the backend, so it gets the whole list, not just this scope. */}
      {modal === 'add' && (
        <AddContactPersonModal
          locations={locations} departments={departments} statuses={statuses} existing={contacts}
          lockLocationId={scope === 'location' ? scopeId : undefined}
          lockDepartmentId={scope === 'department' ? scopeId : undefined}
          customerName={scopeName}
          onCreate={onAdd} onClose={() => setModal(null)}
          // A CSV import creates rows in bulk, so there is no single record to splice in —
          // announce it on the channel the owning hook already listens to and let it refetch.
          onImported={() => window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))}
        />
      )}
    </div>
  )
}
