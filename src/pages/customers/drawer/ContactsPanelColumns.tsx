/**
 * useContactsPanelColumns — split out of ContactsPanel (§3 mechanical split, file pushed
 * past ~400 lines). Owns the DataTable column definitions ContactsPanel renders: soft
 * chips for location/department, the last-contact icon, the per-location "make primary"
 * star and the uncouple action. Columns are IDENTICAL everywhere except that a scope
 * drops its own redundant column: inside one location every row says the same location,
 * inside a department the same department (and its location) — the only permitted
 * deviation from the customer tab's look.
 */
import { type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Star, Loader2, Unlink } from 'lucide-react'
import type { Column } from '@/components/ui/DataTable'
import SoftChipJs from '@/components/ui/SoftChip'
import LookupIcon from '@/components/ui/LookupIcon'
import { emailValue, phoneValue } from '@/components/drawer/contactLinks'
import { useLastContactTypes } from '@/lib/useLastContactTypes'
import { useDateFormat } from '@/lib/datetime'
import { useChipColors } from '@/lib/settings/useChipColors'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { isPrimaryForLocation, isPrimaryForDepartment } from '../hooks/useCustomerContacts'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import { useContactPrimaryPromotion } from './useContactPrimaryPromotion'
import type { ContactScope } from './ContactsPanel'
import type { Contact, Department } from '@/types/customer'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>
const muted = { color: 'var(--text-muted)', fontSize: 12 }
// Plain-text fallback style for a coloured column toggled off (CHIPKLEUR-INSTELBAAR-1) —
// mirrors the `plainCell` convention in CandidatesTable/CustomersTable.
const plainCell = { color: 'var(--text)', fontSize: 12 }
const iconBtn = {
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
  cursor: 'pointer', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', flexShrink: 0,
} as const

interface Params {
  scope: ContactScope
  scopeId?: Id
  /** Whether the "make primary here" star column applies — only inside a location. */
  locationScope: boolean
  locations: { id: Id; name: string }[]
  departments: Department[]
  onUpdate: (id: Id, payload: Partial<ContactPayload>) => void
}

export function useContactsPanelColumns({ scope, scopeId, locationScope, locations, departments, onUpdate }: Params): Column<Contact>[] {
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
  // CONTACT-LOCATION-PRIMARY-1/CONTACT-DEPARTMENT-PRIMARY-1: which row's "make primary
  // here" PUT is in flight — one at a time, so a double click cannot race two promotions
  // at the same site. The hook picks location vs. department off `scope` itself.
  const { promoting, promote } = useContactPrimaryPromotion(scope, scopeId)
  // CONTACT-DEPARTMENT-PRIMARY-1: the star column/chip pair now also applies inside a
  // department. `locationScope` (computed by ContactsPanel.tsx, out of scope for this
  // change) only covers the location half, so the department half is widened in here.
  const scopedPrimary = locationScope || (scope === 'department' && scopeId != null)
  // Reads the right pivot flag for whichever of the two nested scopes is active.
  const isPrimaryHere = (p: Contact) => scope === 'department' ? isPrimaryForDepartment(p, scopeId as Id) : isPrimaryForLocation(p, scopeId as Id)

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

  return [
    { key: 'name', header: t('contacts.col.name'), sortable: true, sortValue: p => p.name,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{p.name}</span>
          {/* TWO different primaries can sit on the SAME row inside a location/department:
              the customer's one main contact and this site's own. Where both can appear,
              each chip names its scope — an unqualified "Primair" twice would be a lie
              about what either means. Outside those two scopes only the customer axis
              exists, so the short label stays there. */}
          {p.isPrimary && <SoftChip label={scopedPrimary ? t('contacts.primaryCustomerChip') : t('contacts.primaryChip')}
            color="var(--color-success)" round size={10} />}
          {scopedPrimary && isPrimaryHere(p) &&
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
    // CONTACT-LOCATION-PRIMARY-1/CONTACT-DEPARTMENT-PRIMARY-1: who to call AT THIS SITE
    // or department. Only inside those two scopes — the flag lives on the contact↔
    // location / contact↔department coupling and exists nowhere else.
    ...(scopedPrimary ? [{
      key: 'locationPrimary', header: t('contacts.col.locationPrimary'), align: 'center' as const,
      render: (p: Contact) => {
        const isHere = isPrimaryHere(p)
        const busy = String(promoting) === String(p.id)
        // The department twin says "department" instead of "location" — same string
        // shape, different noun (departments.detail.* is a genuinely new i18n key; the
        // location.* strings are reused verbatim wherever the copy has no scope word).
        const isPrimaryLabel = t(scope === 'department' ? 'departments.detail.isPrimaryContact' : 'locations.detail.isPrimaryContact')
        const setPrimaryLabel = t(scope === 'department' ? 'departments.detail.setPrimaryContact' : 'locations.detail.setPrimaryContact')
        // Already primary here: a state, not a switch. The backend has no "unset" route,
        // so an off-toggle would be an affordance with nothing behind it (§3) — the flag
        // moves when someone else is promoted.
        if (isHere) return (
          <span title={isPrimaryLabel} role="img" aria-label={isPrimaryLabel}
            style={{ display: 'inline-flex', color: 'var(--color-primary-text)' }}>
            <Star size={13} fill="currentColor" />
          </span>
        )
        // Without the owning customer id there is no route to PUT to — render it disabled
        // rather than firing /customers/undefined/… and calling that an action.
        const blocked = p.customerId == null
        return (
          <button type="button" onClick={e => { e.stopPropagation(); void promote(p) }}
            disabled={busy || blocked || promoting != null}
            title={setPrimaryLabel} aria-label={setPrimaryLabel}
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
}
