/**
 * ContactLinkSection — a contact's Locatie and Afdeling coupling, rendered in the SAME
 * shape as "+ Vestiging" (Danny 28-07: "zowel de locatie als afdeling moet hetzelfde
 * eruit zien en werken als +vestiging"): a section label with an add-trigger on the
 * right, a card below holding the current value as a removable chip, and an italic empty
 * state when nothing is linked.
 *
 * It cannot literally BE BranchSection: that component is multi-value, and a contact
 * holds exactly ONE location and ONE department today (customer_location_id /
 * customer_department_id — the pivots exist backend-side but this app never writes them).
 * So this mirrors its layout and its interaction while staying single-value: picking a
 * value REPLACES the current one, and removing the chip clears it.
 *
 * The cascade is the rule that survives from the old picker pair: a department belongs to
 * exactly one location, so the department picker only offers departments of the linked
 * location, and changing the location clears a department that no longer fits. Saving an
 * uncoupled pair would be invalid data, not a cosmetic problem.
 */
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'

interface Props {
  locationId: Id | null
  departmentId: Id | null
  locations: { id: Id; name: string }[]
  departments: Department[]
  onChange: (patch: { locationId?: Id | null; departmentId?: Id | null }) => void
}

// One labelled row: the add-trigger on the right, the linked value as a chip below.
function LinkRow({ label, addLabel, emptyLabel, options, selectedId, onPick, onClear }: {
  label: string; addLabel: string; emptyLabel: string
  options: { value: string; label: string }[]
  selectedId: Id | null
  onPick: (id: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation('common')
  const current = selectedId != null ? options.find(o => o.value === String(selectedId)) : undefined
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={cardHead}>{label}</div>
        <SearchSelect triggerLabel={addLabel} options={options} selected={current ? [current.value] : []}
          onToggle={onPick} menuAlign="right"
          renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={addLabel} />} />
      </div>
      <div style={cardBox}>
        {current ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
            borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
            {current.label}
            <button onClick={onClear} aria-label={t('remove')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{emptyLabel}</span>
        )}
      </div>
    </div>
  )
}

export default function ContactLinkSection({ locationId, departmentId, locations, departments, onChange }: Props) {
  const { t } = useTranslation('customers')

  const locationOptions = locations.map(l => ({ value: String(l.id), label: l.name }))
  // Departments of the LINKED location only — never the customer's whole list: a
  // department belongs to one location, so offering the rest would let an invalid pair
  // be saved. No location linked yet = nothing to offer.
  const departmentOptions = (locationId != null
    ? departments.filter(d => String(d.locationId) === String(locationId))
    : []
  ).map(d => ({ value: String(d.id), label: d.name }))

  // Picking a location clears a department that does not belong to it — including when
  // the same value is re-picked, which SearchSelect reports as a toggle.
  const pickLocation = (value: string) => {
    const next = String(locationId) === value ? null : value
    const keepsDepartment = departments.some(d => String(d.id) === String(departmentId) && String(d.locationId) === String(next))
    onChange({ locationId: next, ...(keepsDepartment ? {} : { departmentId: null }) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LinkRow label={t('contacts.detail.location')} addLabel={t('contacts.detail.linkLocation')}
        emptyLabel={t('locations.detail.none')} options={locationOptions} selectedId={locationId}
        onPick={pickLocation} onClear={() => onChange({ locationId: null, departmentId: null })} />
      <LinkRow label={t('contacts.detail.department')} addLabel={t('contacts.detail.linkDepartment')}
        emptyLabel={locationId == null ? t('subModal.pickLocationFirst') : t('locations.detail.none')}
        options={departmentOptions} selectedId={departmentId}
        onPick={v => onChange({ departmentId: String(departmentId) === v ? null : v })}
        onClear={() => onChange({ departmentId: null })} />
    </div>
  )
}
