import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useCustomerCascade } from './useCustomerCascade'

interface Picked { id: string; name: string }
interface Args {
  clientId: string
  customerLocationId: string
  onLocationChange: (v: Picked) => void
  customerDepartmentId: string
  onDepartmentChange: (v: Picked) => void
  contactId: string
  onContactChange: (v: Picked) => void
}

/**
 * useCascadePickers — the locatie/afdeling/contactpersoon dropdowns for the vacancy
 * Algemeen card (V4-V6, VACATURES-100), each a bare CreatableSelect (allowCreate=false)
 * so the caller places them in its own labelled row (mirrors DetailsTab's row()
 * convention — the client field already has its own row). Cascade fetch + reset
 * logic mirrors KlantTab/MatchPlacementModal (useCustomerCascade): picking a
 * department directly auto-fills its parent location; narrowing to one location's
 * departments once one is picked.
 *
 * MEASURED (VACATURES-100 V4-V6): UpdateVacancyRequest has no customer_location_id/
 * customer_department_id/contact_id columns on `vacancies` (only the unrelated
 * bureau-branch `location_id`) — see buildVacancyPatch's comment. The picks still
 * flow through onUpdate best-effort (harmlessly dropped server-side today, same
 * "tolerated until BE ships the columns" precedent as MatchPlacementModal).
 */
export function useCascadePickers({
  clientId, customerLocationId, onLocationChange, customerDepartmentId, onDepartmentChange, contactId, onContactChange,
}: Args) {
  const { t } = useTranslation('vacancies')
  const { locations, contacts } = useCustomerCascade(clientId)

  const allDepartments = locations.flatMap(l => (l.departments ?? []).map(d => ({ ...d, locationId: l.id })))
  const departments = customerLocationId
    ? (locations.find(l => String(l.id) === customerLocationId)?.departments ?? [])
    : allDepartments

  const opt = (arr: Array<{ id?: string | number; name?: string }>) =>
    arr.map(x => ({ value: String(x.id), label: x.name ?? '—' }))
  const placeholder = clientId ? t('common:select') : t('details.pickClientFirst')

  const handleLocationChange = (id: string) => {
    onLocationChange({ id, name: locations.find(l => String(l.id) === id)?.name ?? '' })
    onDepartmentChange({ id: '', name: '' })
  }
  // Picking a department directly (before its parent location) auto-fills the
  // location too, so the pair stays consistent.
  const handleDepartmentChange = (id: string) => {
    const dep = allDepartments.find(d => String(d.id) === id)
    onDepartmentChange({ id, name: dep?.name ?? '' })
    if (!customerLocationId && dep?.locationId != null) {
      onLocationChange({ id: String(dep.locationId), name: locations.find(l => String(l.id) === String(dep.locationId))?.name ?? '' })
    }
  }
  const handleContactChange = (id: string) =>
    onContactChange({ id, name: contacts.find(c => String(c.id) === id)?.name ?? '' })

  return {
    locationPicker: (
      <CreatableSelect value={customerLocationId || null} onChange={handleLocationChange} allowCreate={false}
        placeholder={placeholder} options={opt(locations)} />
    ),
    departmentPicker: (
      <CreatableSelect value={customerDepartmentId || null} onChange={handleDepartmentChange} allowCreate={false}
        placeholder={placeholder} options={opt(departments)} />
    ),
    contactPicker: (
      <CreatableSelect value={contactId || null} onChange={handleContactChange} allowCreate={false}
        placeholder={placeholder} options={opt(contacts)} />
    ),
  }
}
