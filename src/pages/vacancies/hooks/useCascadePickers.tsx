import { useTranslation } from 'react-i18next'
import { contactOptionLabel } from '@/lib/contactLabel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useCustomerCascade} from './useCustomerCascade'

interface Picked { id: string; name: string }
// V9 (Danny vacatures-ronde): the location pick also carries its own address,
// so the caller (useVacancyDetailsForm) can take it over onto the Locatie
// section's form the moment a customer location is chosen.
export interface PickedLocation extends Picked {
  street?: string; houseNumber?: string; houseNumberSuffix?: string
  postalCode?: string; city?: string; province?: string; country?: string
}
interface Args {
  clientId: string
  customerLocationId: string
  onLocationChange: (v: PickedLocation) => void
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
 * logic mirrors KlantTab/MatchModal (useCustomerCascade): picking a
 * department directly auto-fills its parent location; narrowing to one location's
 * departments once one is picked.
 *
 * VAC-CASCADE-1 (backend wave 6): `vacancies` now persists customer_location_id/
 * customer_department_id/contact_id (VacancyWriter's scalar passthrough whitelist),
 * so the picks made here are a real save, not a best-effort no-op — see
 * buildVacancyPatch and DetailsTab's seedCascade.
 *
 * VAC-CLEAR-1 (Danny: "gekozen waarde weer leegmaken"): each level is OPTIONAL, so
 * each level is `clearable`. Clearing emits the empty id, which useVacancyDetailsForm
 * saves as `null` → buildVacancyPatch → customer_location_id/customer_department_id/
 * contact_id: null (all three are `sometimes|nullable|uuid` server-side), so an unset
 * really persists. Clearing the location clears its department too — the same
 * dependant reset a location SWITCH already does.
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
    const loc = locations.find(l => String(l.id) === id)
    // V9: forward the picked location's own address alongside id/name — the
    // caller decides whether/how to take it over onto the vacancy's address form.
    onLocationChange({
      id, name: loc?.name ?? '',
      street: loc?.street ?? '', houseNumber: loc?.house_number ?? '', houseNumberSuffix: loc?.house_number_suffix ?? '',
      postalCode: loc?.postcode ?? '', city: loc?.city ?? '', province: loc?.province ?? '', country: loc?.country ?? '',
    })
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
        clearable clearLabel={t('details.customerLocation')}
        placeholder={placeholder} options={opt(locations)} />
    ),
    departmentPicker: (
      <CreatableSelect value={customerDepartmentId || null} onChange={handleDepartmentChange} allowCreate={false}
        clearable clearLabel={t('details.customerDepartment')}
        placeholder={placeholder} options={opt(departments)} />
    ),
    contactPicker: (
      <CreatableSelect value={contactId || null} onChange={handleContactChange} allowCreate={false}
        clearable clearLabel={t('details.contactPerson')}
        placeholder={placeholder} options={contacts.map(c => ({ value: String(c.id), label: contactOptionLabel(c) }))} />
    ),
  }
}
