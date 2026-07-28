/**
 * ContactsTab — the customer's contact persons as a searchable table. Each row
 * shows the coupled LOCATIONS + DEPARTMENTS (CONTACT-MULTI-1: a contact can serve
 * several sites/departments) as one soft chip per link; a row drills into
 * ContactDetail for full edit (EditableFieldTable house pattern) + delete.
 * "+ Nieuw contactpersoon" opens the full grouped AddContactPersonModal.
 *
 * BUG FIX (Danny 2026-07-14): the Locatie/Afdeling columns used to read the
 * singular locationName/departmentName, which the list endpoint never populates
 * (only the plural locations[]/departments[] are eager-loaded there) — every row
 * showed "—" even though the coupling existed (visible on drill-in). Fixed in the
 * mapper (mapContact) by reading the arrays; rendered here as multi-ready chips.
 *
 * MEASURED (2026-07-14): for every currently-seeded demo contact the plural
 * locations[]/departments[] arrays come back EMPTY — only the legacy singular
 * customer_location_id/customer_department_id are populated (CONTACT-MULTI-1's
 * pivot tables were never backfilled from the pre-existing singular columns —
 * filed as a BE finding in the delivery report). Until that backfill ships, this
 * tab falls back to resolving the singular id against the customer-wide
 * locations/departments PROPS it already has (same ones ContactDetail uses) so
 * the column isn't stuck on "—" for every row in the meantime.
 *
 * Dedupe-by-id for a measured duplicate-row issue lives at the shared source
 * (useCustomerContacts) so both this tab AND the location detail's nested list
 * stay correct — see that hook's docblock for the finding.
 *
 * COLUMNS (Danny 28-07: "contactpersonen tabel moet meer informatie bevatten ...
 * status maar ook mobile met hyperlink en email met hyperlink ... laatste contact
 * datum en type"): added Status, a dedicated Mobile column and a combined
 * Last-contact column; Email/Mobile/Phone now render as real mailto:/tel: links
 * via the shared `contactLinks` renderer (never a second hand-rolled hyperlink).
 * The primary contact is now a real text CHIP next to the name, not a bare icon —
 * colour alone must never be the only signal (§6 WCAG); Danny could not tell who
 * was primary from the icon alone.
 */
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import ContactDetail from './ContactDetail'
import AddContactPersonModal from '../AddContactPersonModal'
import type { Column } from '@/components/ui/DataTable'
import SoftChipJs from '@/components/ui/SoftChip'
import { emailValue, phoneValue } from '@/components/drawer/contactLinks'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useDateFormat } from '@/lib/datetime'
import LookupIcon from '@/components/ui/LookupIcon'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>
const muted = { color: 'var(--text-muted)', fontSize: 12 }

interface Props {
  contacts?: Contact[]
  locations?: { id: Id; name: string }[]
  departments?: Department[]
  statuses?: LookupOption[]
  // EXTRACT-1: the caller's own customers.update permission check, threaded down
  // to the Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  onAdd: (payload: ContactPayload) => void
  onUpdate: (id: Id, payload: Partial<ContactPayload>) => void
  onRemove: (id: Id) => void
}

// One soft chip per linked location/department; a wrapped row so a contact
// serving several sites still reads cleanly (multi-ready, CONTACT-MULTI-1).
const chipList = (items: { id: Id; name: string }[], color: string) =>
  items.length === 0 ? '—' : (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map(i => <SoftChip key={String(i.id)} label={i.name} color={color} />)}
    </div>
  )

export default function ContactsTab({ contacts = [], locations = [], departments = [], statuses = [], canLinkBackoffice = false, onAdd, onUpdate, onRemove }: Props) {
  const { t } = useTranslation('customers')
  const [adding, setAdding] = useState(false)
  // Last-contact channel lookup (label + settings-managed icon) — the same
  // source CandidatesTable reads for its own combined last-contact column.
  const { labelOf: lastContactLabel, iconOf: lastContactIcon } = useLastContactTypes()
  const { formatDate } = useDateFormat()

  // Fallback resolver — the multi-array (see file docblock) is empty for every
  // seeded contact today; resolve the PRIMARY singular link against the already-
  // fetched customer-wide lists so the column shows real data, not a blanket "—".
  const resolvedLocations = (p: Contact) => p.locations.length > 0 ? p.locations
    : (p.locationId != null ? locations.filter(l => String(l.id) === String(p.locationId)) : [])
  const resolvedDepartments = (p: Contact): { id: Id; name: string }[] => p.departments.length > 0 ? p.departments
    : (p.departmentId != null ? departments.filter(d => String(d.id) === String(p.departmentId)).map(d => ({ id: d.id as Id, name: d.name })) : [])

  const columns: Column<Contact>[] = [
    { key: 'name', header: t('contacts.col.name'), sortable: true, sortValue: p => p.name,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{p.name}</span>
          {p.isPrimary && <SoftChip label={t('contacts.primaryChip')} color="var(--color-success)" round size={10} />}
        </div>
      ) },
    // Deployability/lifecycle status — same soft-chip fallback as the sibling
    // Locations tab (LocationsTab.tsx): never a hardcoded look, '—' when unset.
    { key: 'status', header: t('contacts.col.status'), sortable: true, sortValue: p => p.statusLabel,
      render: p => p.statusLabel ? <SoftChip label={p.statusLabel} color={p.statusColor} /> : '—' },
    { key: 'location', header: t('contacts.col.location'), sortable: true, sortValue: p => p.locationName,
      render: p => chipList(resolvedLocations(p), 'var(--color-secondary)') },
    { key: 'department', header: t('contacts.col.department'), sortable: true, sortValue: p => p.departmentName,
      render: p => chipList(resolvedDepartments(p), 'var(--color-violet)') },
    { key: 'role',  header: t('contacts.col.role'),  cellStyle: muted, sortable: true, sortValue: p => p.role,  render: p => p.role || '—' },
    // Real mailto link + shortcut icon (Danny 28-07) — the ONE shared renderer
    // (contactLinks), never a second hand-rolled hyperlink.
    { key: 'email', header: t('contacts.col.email'), cellStyle: muted, sortable: true, sortValue: p => p.email,
      render: p => emailValue(p.email, t('contacts.detail.email')) },
    // Mobile is now its OWN column (split from the old combined phone/mobile
    // fallback column) WITH the WhatsApp shortcut — correct only here, since this
    // column IS the mobile number; never pass the whatsapp arg for the landline.
    { key: 'mobile', header: t('contacts.col.mobile'), nowrap: true, cellStyle: muted, sortable: true, sortValue: p => p.mobile,
      render: p => phoneValue(p.mobile, t('contacts.detail.callPhone'), { label: t('contacts.detail.whatsapp') }) },
    // NO separate landline column on purpose: nine columns did not fit the drawer and
    // Danny asked for the MOBILE number specifically. The landline stays one click away
    // in the drill-down's Telefoonnummers card, where both numbers live.
    {
      // Combined last-contact column (date + channel icon) — mirrors
      // CandidatesTable's own cell minus the click-through: a contact has no
      // conversations/notes screen to open, so this is a plain span, not a button.
      // Always '—' today: lastContactAt is null until CustomerContactResource
      // sends it (see the Contact type comment) — that is expected, not a bug.
      key: 'lastContact', header: t('contacts.col.lastContact'), nowrap: true,
      sortable: true, sortValue: p => p.lastContactAt ?? '',
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
      },
    },
  ]

  const renderDetail = (p: Contact, close: () => void) => (
    <ContactDetail contact={p} locations={locations} departments={departments} statuses={statuses}
      existing={contacts} canLinkBackoffice={canLinkBackoffice}
      onSave={onUpdate} onDelete={onRemove} close={close} />
  )

  return (
    <>
      {/* Horizontal scroll owned HERE, not the page body. Neither DataTable nor
          SubEntityTab wrap the table in a scroll container, and the ancestor
          EntityDrawer panel clips overflow (`overflow:hidden` on a fixed
          580/880px width) — without this wrapper the 9 columns would be
          silently CUT OFF (unreachable), never a page-wide sideways scroll. */}
      <div style={{ overflowX: 'auto' }}>
        <SubEntityTab
          items={contacts}
          columns={columns}
          addLabel={t('contacts.add')}
          emptyText={t('contacts.empty')}
          searchPlaceholder={t('contacts.searchPlaceholder')}
          backLabel={t('drawer.back')}
          searchKeys={['name', 'role', 'email', 'mobile']}
          onAdd={() => setAdding(true)}
          renderDetail={renderDetail}
        />
      </div>
      {/* `existing` feeds the modal's duplicate check (email/phone/mobile) and its
          "replace the current primary contact?" question — both need the customer's
          OTHER contacts, which this tab already holds. */}
      {adding && (
        <AddContactPersonModal locations={locations} departments={departments} statuses={statuses}
          existing={contacts} onCreate={onAdd} onClose={() => setAdding(false)} />
      )}
    </>
  )
}
