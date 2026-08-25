/**
 * ContactLinkSection — a contact's Locatie and Afdeling coupling, rendered in the SAME
 * shape as "+ Vestiging" (Danny 28-07: "zowel de locatie als afdeling moet hetzelfde
 * eruit zien en werken als +vestiging", i.e. "both the location and the department
 * must look and work the same as +branch"): a section label with an add-trigger on the
 * right, a card below holding the current value as a removable chip, and an italic empty
 * state when nothing is linked.
 *
 * MULTI-VALUE (Danny 28-07: "een contactpersoon moet aan meerdere locaties en afdelingen
 * gekoppeld kunnen worden", i.e. "a contact must be linkable to multiple locations and
 * departments"). The backend has supported this all along through two pivot
 * tables and `location_ids[]`/`department_ids[]`; this app only ever wrote the singular
 * columns. It writes the arrays now — see the hook's toApi for the one asymmetry that has
 * to be compensated for.
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
  /** The FULL sets (CONTACT-MULTI-1). Read array-or-singular by the caller. */
  locationIds: Id[]
  departmentIds: Id[]
  locations: { id: Id; name: string }[]
  departments: Department[]
  onChange: (patch: { locationIds?: Id[]; departmentIds?: Id[] }) => void
}

// One labelled row: the add-trigger on the right, every linked value as a removable chip.
function LinkRow({ label, addLabel, emptyLabel, options, selectedIds, onToggle }: {
  label: string; addLabel: string; emptyLabel: string
  options: { value: string; label: string }[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const { t } = useTranslation('common')
  const chips = selectedIds
    .map(id => options.find(o => o.value === id) ?? { value: id, label: id })
    .filter(o => o.label !== o.value || options.length === 0)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={cardHead}>{label}</div>
        <SearchSelect triggerLabel={addLabel} options={options} selected={selectedIds}
          onToggle={onToggle} menuAlign="right"
          renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={addLabel} />} />
      </div>
      <div style={cardBox}>
        {chips.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {chips.map(o => (
              <span key={o.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                {o.label}
                <button onClick={() => onToggle(o.value)} aria-label={t('remove')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{emptyLabel}</span>
        )}
      </div>
    </div>
  )
}

export default function ContactLinkSection({ locationIds, departmentIds, locations, departments, onChange }: Props) {
  const { t } = useTranslation('customers')
  const locIds = locationIds.map(String)
  const depIds = departmentIds.map(String)

  const locationOptions = locations.map(l => ({ value: String(l.id), label: l.name }))
  // Departments of the LINKED locations only — a department belongs to exactly one
  // location, so offering the rest would let an impossible pair be saved.
  const departmentOptions = departments
    .filter(d => locIds.includes(String(d.locationId)))
    .map(d => ({ value: String(d.id), label: d.name }))

  // Unlinking a location also drops its departments — otherwise the contact keeps a
  // department at a site it no longer serves, which is invalid data, not just untidy.
  const toggleLocation = (value: string) => {
    const next = locIds.includes(value) ? locIds.filter(v => v !== value) : [...locIds, value]
    const stillValid = depIds.filter(id => {
      const dep = departments.find(d => String(d.id) === id)
      return dep ? next.includes(String(dep.locationId)) : false
    })
    onChange({ locationIds: next, ...(stillValid.length !== depIds.length ? { departmentIds: stillValid } : {}) })
  }

  const toggleDepartment = (value: string) =>
    onChange({ departmentIds: depIds.includes(value) ? depIds.filter(v => v !== value) : [...depIds, value] })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LinkRow label={t('contacts.detail.location')} addLabel={t('contacts.detail.linkLocation')}
        emptyLabel={t('locations.detail.none')} options={locationOptions} selectedIds={locIds}
        onToggle={toggleLocation} />
      <LinkRow label={t('contacts.detail.department')} addLabel={t('contacts.detail.linkDepartment')}
        emptyLabel={locIds.length === 0 ? t('subModal.pickLocationFirst') : t('locations.detail.none')}
        options={departmentOptions} selectedIds={depIds} onToggle={toggleDepartment} />
    </div>
  )
}
