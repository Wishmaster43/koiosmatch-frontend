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
import { Search, Users, Link2, Unlink } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import StatusFilterSelect, { useStatusFilter } from './StatusFilterSelect'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import type { Crumb } from '@/components/drawer/DrillBreadcrumb'
import SoftChipJs from '@/components/ui/SoftChip'
import LookupIcon from '@/components/ui/LookupIcon'
import { emailValue, phoneValue } from '@/components/drawer/contactLinks'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useDateFormat } from '@/lib/datetime'
import { useChipColors } from '@/lib/settings/useChipColors'
import ContactDetail from './ContactDetail'
import ContactLinkPicker from './ContactLinkPicker'
import AddContactPersonModal from '../AddContactPersonModal'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>
const muted = { color: 'var(--text-muted)', fontSize: 12 }

const searchWrap = {
  display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px',
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
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'add' | 'couple' | Contact | null>(null)

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
  const { value: statusFilter, setValue: setStatusFilter, filtered: rows } = useStatusFilter(scoped, statuses)
  // Resolved against the CUSTOMER-WIDE list, never the scoped rows: editing a contact's
  // location moves it out of this scope, and the open detail must not vanish mid-edit.
  const selected = openId != null ? contacts.find(c => String(c.id) === String(openId)) ?? null : null

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
          {p.isPrimary && <SoftChip label={t('contacts.primaryChip')} color="var(--color-success)" round size={10} />}
        </div>
      ) },
    { key: 'status', header: t('contacts.col.status'), sortable: true, sortValue: p => p.statusLabel,
      render: p => p.statusLabel ? <SoftChip label={p.statusLabel} color={p.statusColor} /> : '—' },
    ...(scope === 'customer' ? [{
      key: 'location', header: t('contacts.col.location'), sortable: true, sortValue: (p: Contact) => p.locationName,
      render: (p: Contact) => chipList(resolvedLocations(p), locationChipColor),
    }] : []),
    ...(scope !== 'department' ? [{
      key: 'department', header: t('contacts.col.department'), sortable: true, sortValue: (p: Contact) => p.departmentName,
      render: (p: Contact) => chipList(resolvedDepartments(p), departmentChipColor),
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
        <ContactDetail contact={selected} locations={locations} departments={departments} statuses={statuses}
          existing={contacts} canLinkBackoffice={canLinkBackoffice}
          onSave={onUpdate} onDelete={onRemove} close={() => onOpenChange(null)} />
      </div>
    )
  }

  // ── List view ──
  const q = search.trim().toLowerCase()
  const visible = q
    ? rows.filter(c => [c.name, c.role, c.email, c.mobile].some(v => String(v ?? '').toLowerCase().includes(q)))
    : rows
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
        <StatusFilterSelect value={statusFilter} onChange={setStatusFilter} statuses={statuses} />
        {/* Coupling only exists inside a scope; at customer level a contact is already "here". */}
        {scope !== 'customer' && (
          <DrawerAddButton onClick={() => setModal('couple')} icon={Link2}
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
        />
      )}
    </div>
  )
}
