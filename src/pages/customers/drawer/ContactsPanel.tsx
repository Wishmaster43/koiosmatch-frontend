/**
 * ContactsPanel — THE contact-person surface of the customer drawer. One component for
 * all three scopes: the customer's own Contactpersonen tab, a location's contact list and
 * a department's. Before this there were three hand-rolled variants (a full table, a
 * bordered row list and a bare SectionCard list) that agreed on nothing — Danny 28-07:
 * "het contactpersonen tabblad op locatie en afdeling komt niet overeen met dat van de
 * hoofdklant". Same columns, same chips, same actions, same drill-down, everywhere.
 *
 * IT NEVER NAVIGATES. Clicking a row swaps THIS panel's body from the list to
 * ContactDetail and shows the shared breadcrumb trail. The host stays mounted, so a
 * location keeps its position, its sub-tab and its in-progress edits — the whole point of
 * Danny's report: "als je dan terug klikt ben je uit de vestiging of afdeling???". The
 * old fix routed the click through the drawer's MAIN tab, which unmounted the locations
 * tab and destroyed exactly that state.
 *
 * MEMBERSHIP LIVES HERE, ONCE. The panel always receives the customer-wide contact list
 * and narrows it itself, so the "does this contact belong to X" rule exists in one place
 * instead of the three copies that were drifting apart.
 */
import { useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Users, Link2, Unlink, Star, Loader2 } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import type { Crumb } from '@/components/drawer/DrillBreadcrumb'
import SoftChipJs from '@/components/ui/SoftChip'
import LookupIcon from '@/components/ui/LookupIcon'
import { emailValue, phoneValue } from '@/components/drawer/contactLinks'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useDateFormat } from '@/lib/datetime'
import { useChipColors } from '@/lib/settings/useChipColors'
import { useAllSettings, useSettingsLoaded, getBoolSetting, getStringSetting } from '@/lib/settings/useAllSettings'
import ContactDetail from './ContactDetail'
import ContactLinkPicker from './ContactLinkPicker'
import AddContactPersonModal from '../AddContactPersonModal'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import { notifyError, notifySuccess } from '@/lib/notify'
import { CONTACTS_CHANGED_EVENT, isPrimaryForLocation, setLocationPrimaryContact } from '../hooks/useCustomerContacts'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { DrillPagerProps } from '@/components/drawer/DrillPager'

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
const iconBtn = {
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
  cursor: 'pointer', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', flexShrink: 0,
} as const

export type ContactScope = 'customer' | 'location' | 'department'

interface Props {
  /** ALWAYS the customer-wide list — the panel narrows it per scope itself. */
  contacts: Contact[]
  scope: ContactScope
  /** The record we are inside, for the scope filter, the back label and the couple action. */
  scopeId?: Id
  scopeName?: string
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

export default function ContactsPanel({
  contacts, scope, scopeId, scopeName, locations, departments, statuses,
  canLinkBackoffice = false, openId, onOpenChange, trail = [], onAdd, onUpdate, onRemove,
}: Props) {
  const { t } = useTranslation('customers')
  const { labelOf: lastContactLabel, iconOf: lastContactIcon } = useLastContactTypes()
  const { formatDate } = useDateFormat()
  // Tenant-configurable chip colours (CHIPKLEUR-INSTELBAAR-1) — falls back to today's
  // hardcoded colours until a tenant saves an override in Settings.
  const { location: locationChipColor, department: departmentChipColor } = useChipColors()
  // Colour-on/off flags per column (CHIPKLEUR-INSTELBAAR-1) — both default ON, so an
  // absent setting keeps today's coloured-chip look.
  const settings = useAllSettings()
  const colorLocationCol = getBoolSetting(settings, 'customer_contact_table_color_location', true)
  const colorDepartmentCol = getBoolSetting(settings, 'customer_contact_table_color_department', true)
  // The status column's own flag. It was left out of the original contract because the
  // contact list had no status column; it has one now, and the backend needs no change —
  // SettingController validates this family by PATTERN (`str_contains(key,
  // '_table_color_')`), not against a fixed list, so the key is accepted as-is.
  const colorStatusCol = getBoolSetting(settings, 'customer_contact_table_color_status', true)
  // Tenant-configured default status filter (TENANT-DEFAULT-1, Danny 02-08) — replaces
  // the old "active only" guess when Settings → Klanten → Tabelweergave → Contactpersonen
  // has one saved; absent (null) falls back to that original guess unchanged. `settingsLoaded`
  // stops the hook from deciding before /settings has actually answered (see its own docblock).
  const settingsLoaded = useSettingsLoaded()
  const defaultStatusFilter = getStringSetting(settings, 'customer_contact_default_status_filter')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'couple' | Contact | null>(null)
  // Which row's "make primary here" PUT is in flight (CONTACT-LOCATION-PRIMARY-1) — one
  // at a time, so a double click cannot race two promotions at the same site.
  const [promoting, setPromoting] = useState<Id | null>(null)

  // The per-site primary only exists INSIDE a location. A department has no such flag on
  // the backend and the customer axis is a different field entirely, so the whole control
  // is absent elsewhere rather than disabled — there is nothing to write there.
  const locationScope = scope === 'location' && scopeId != null

  /**
   * Promote this contact to the primary contact OF THIS LOCATION. It demotes the previous
   * primary of THIS SITE only; the customer's own main contact (`isPrimary`) is a
   * different field and is left alone. There is deliberately no "unset" — the backend has
   * no route for it, so the flag moves by promoting someone else instead of by a toggle
   * with nothing behind it. The owning hook refetches via CONTACTS_CHANGED_EVENT.
   */
  const promote = async (c: Contact) => {
    if (!locationScope || c.id == null || c.customerId == null || promoting != null) return
    setPromoting(c.id)
    try {
      const applied = await setLocationPrimaryContact(c.customerId, c.id, scopeId as Id)
      // A 200 that did not move the flag is still a failure for the user (the pivot column
      // is not on this tenant database yet) — say so instead of showing a silent no-op.
      if (applied) notifySuccess(t('locations.detail.setPrimaryContactDone', { name: c.name }))
      else notifyError(t('locations.detail.setPrimaryContactUnavailable'))
    } catch {
      notifyError(t('locations.detail.setPrimaryContactFailed'))
    } finally {
      setPromoting(null)
    }
  }

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
  const scoped = contacts.filter(inScope)
  // Status filter (Danny 28-07) — same component and same defaulting rule on all three lists.
  const { value: statusFilter, toggle: toggleStatus, filtered: rows } =
    useStatusFilter(scoped, statuses, undefined, defaultStatusFilter, settingsLoaded)
  // Resolved against the CUSTOMER-WIDE list, never the scoped rows: editing a contact's
  // location moves it out of this scope, and the open detail must not vanish mid-edit.
  const selected = openId != null ? contacts.find(c => String(c.id) === String(openId)) ?? null : null

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

  // Fallback resolver — the plural locations[]/departments[] arrays come back EMPTY for
  // every seeded contact; resolve the singular id against the customer-wide lists so the
  // column shows real data instead of a blanket dash.
  const resolvedLocations = (p: Contact) => p.locations.length > 0 ? p.locations
    : (p.locationId != null ? locations.filter(l => String(l.id) === String(p.locationId)) : [])
  const resolvedDepartments = (p: Contact): { id: Id; name: string }[] => p.departments.length > 0 ? p.departments
    : (p.departmentId != null ? departments.filter(d => String(d.id) === String(p.departmentId)).map(d => ({ id: d.id as Id, name: d.name })) : [])

  const chipList = (items: { id: Id; name: string }[], color: string): ReactNode =>
    items.length === 0 ? '—' : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {items.map(i => <SoftChip key={String(i.id)} label={i.name} color={color} />)}
      </div>
    )
  // Plain-text variant for when the column's colour flag is off.
  const plainList = (items: { id: Id; name: string }[]): ReactNode =>
    items.length === 0 ? '—' : <span style={plainCell}>{items.map(i => i.name).join(', ')}</span>

  // Columns are IDENTICAL everywhere except that a scope drops its own redundant column:
  // inside one location every row says the same location, inside a department the same
  // department (and its location). That is the only permitted deviation from the
  // customer tab's look — it removes noise, it never changes the row's meaning.
  const columns: Column<Contact>[] = [
    { key: 'name', header: t('contacts.col.name'), sortable: true, sortValue: p => p.name,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{p.name}</span>
          {/* TWO different primaries can sit on the SAME row inside a location: the
              customer's one main contact and this site's own. Where both can appear, each
              chip names its scope — an unqualified "Primair" twice would be a lie about
              what either means. Outside a location only the customer axis exists, so the
              short label stays there. */}
          {p.isPrimary && <SoftChip label={locationScope ? t('contacts.primaryCustomerChip') : t('contacts.primaryChip')}
            color="var(--color-success)" round size={10} />}
          {locationScope && isPrimaryForLocation(p, scopeId as Id) &&
            <SoftChip label={t('contacts.primaryLocationChip')} color="var(--color-primary)" round size={10} />}
        </div>
      ) },
    { key: 'status', header: t('contacts.col.status'), sortable: true, sortValue: p => p.statusLabel,
      render: p => !p.statusLabel ? '—'
        : colorStatusCol ? <SoftChip label={p.statusLabel} color={p.statusColor} /> : <>{p.statusLabel}</> },
    ...(scope === 'customer' ? [{
      key: 'location', header: t('contacts.col.location'), sortable: true, sortValue: (p: Contact) => p.locationName,
      render: (p: Contact) => colorLocationCol ? chipList(resolvedLocations(p), locationChipColor) : plainList(resolvedLocations(p)),
    }] : []),
    ...(scope !== 'department' ? [{
      key: 'department', header: t('contacts.col.department'), sortable: true, sortValue: (p: Contact) => p.departmentName,
      render: (p: Contact) => colorDepartmentCol ? chipList(resolvedDepartments(p), departmentChipColor) : plainList(resolvedDepartments(p)),
    }] : []),
    { key: 'role', header: t('contacts.col.role'), cellStyle: muted, sortable: true, sortValue: p => p.role, render: p => p.role || '—' },
    { key: 'email', header: t('contacts.col.email'), cellStyle: muted, sortable: true, sortValue: p => p.email,
      render: p => emailValue(p.email, t('contacts.detail.email')) },
    // The WhatsApp shortcut belongs to the MOBILE number and nowhere else.
    { key: 'mobile', header: t('contacts.col.mobile'), nowrap: true, cellStyle: muted, sortable: true, sortValue: p => p.mobile,
      render: p => phoneValue(p.mobile, t('contacts.detail.callPhone'), { label: t('contacts.detail.whatsapp') }) },
    { key: 'lastContact', header: t('contacts.col.lastContact'), nowrap: true, sortable: true, sortValue: p => p.lastContactAt ?? '',
      render: p => {
        if (!p.lastContactAt) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const label = lastContactLabel(p.lastContactType)
        const icon = p.lastContactType ? lastContactIcon(p.lastContactType) : undefined
        return (
          <span title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontSize: 12 }}>
            {formatDate(p.lastContactAt)}
            {icon && <span style={{ display: 'inline-flex', flexShrink: 0, opacity: 0.6 }}><LookupIcon icon={icon} size={12} /></span>}
          </span>
        )
      } },
    // CONTACT-LOCATION-PRIMARY-1: who to call AT THIS SITE. Only inside a location — the
    // flag lives on the contact↔location coupling and exists nowhere else.
    ...(locationScope ? [{
      key: 'locationPrimary', header: t('contacts.col.locationPrimary'), align: 'center' as const,
      render: (p: Contact) => {
        const isHere = isPrimaryForLocation(p, scopeId as Id)
        const busy = String(promoting) === String(p.id)
        // Already primary here: a state, not a switch. The backend has no "unset" route,
        // so an off-toggle would be an affordance with nothing behind it (§3) — the flag
        // moves when someone else is promoted.
        if (isHere) return (
          <span title={t('locations.detail.isPrimaryContact')} role="img" aria-label={t('locations.detail.isPrimaryContact')}
            style={{ display: 'inline-flex', color: 'var(--color-primary)' }}>
            <Star size={13} fill="currentColor" />
          </span>
        )
        // Without the owning customer id there is no route to PUT to — render it disabled
        // rather than firing /customers/undefined/… and calling that an action.
        const blocked = p.customerId == null
        return (
          <button type="button" onClick={e => { e.stopPropagation(); void promote(p) }}
            disabled={busy || blocked || promoting != null}
            title={t('locations.detail.setPrimaryContact')} aria-label={t('locations.detail.setPrimaryContact')}
            style={{ ...iconBtn, cursor: busy || blocked || promoting != null ? 'not-allowed' : 'pointer',
              opacity: blocked ? 0.4 : 1 }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
          </button>
        )
      },
    }] : []),
    // Uncouple only exists inside a scope — at customer level there is nothing to detach from.
    ...(scope === 'customer' ? [] : [{
      key: 'uncouple', header: '', align: 'right' as const,
      render: (p: Contact) => (
        <button onClick={e => { e.stopPropagation(); onUpdate(p.id as Id, scope === 'location' ? { locationId: null } : { departmentId: null }) }}
          title={t(scope === 'location' ? 'locations.detail.uncoupleAction' : 'departments.detail.uncoupleAction')}
          aria-label={t(scope === 'location' ? 'locations.detail.uncoupleAction' : 'departments.detail.uncoupleAction')}
          style={iconBtn}>
          <Unlink size={12} />
        </button>
      ),
    }]),
  ]

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
        {/* Coupling only exists inside a scope; at customer level a contact is already "here".
            Icon-only (Danny 03-08): with search + filter + two buttons the scoped row
            overflowed and clipped the primary add button — the SECONDARY action gives up
            its text (kept as title/aria-label), the primary "+ contactpersoon" never does. */}
        {scope !== 'customer' && (
          <DrawerAddButton onClick={() => setModal('couple')} icon={Link2} iconOnly
            label={t(scope === 'location' ? 'locations.detail.coupleAction' : 'departments.detail.coupleAction')} />
        )}
        <DrawerAddButton onClick={() => setModal('add')} label={t('contacts.add')} />
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
