import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { getCountryOptions, getCountryName } from '@/lib/countries'
import { row, card, controls, dash, makeFieldHelpers } from './detailsFieldKit'
import { composeAddress } from '../hooks/useVacancyDetailsForm'
import type { LocationSection } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

interface Props { vacancy: VacancyDetail; location: LocationSection }

/**
 * DetailsLocationTab — Locatie sub-tab (VAC-DETAILS-SPLIT-1): structured
 * address (street/houseNumber/houseNumberSuffix/postalCode/city, each its own
 * row — V9: mirrors the candidate ProfileAddressTab canon exactly) + country→
 * province cascade (VAC-COUNTRY-1). Its OWN pencil/save/cancel (`location.*`
 * from the hook) — flipping it never touches Algemeen/Eisen/Voorwaarden's drafts.
 */
export default function DetailsLocationTab({ vacancy: v, location }: Props) {
  const { t, i18n } = useTranslation('vacancies')
  // Both lists default to empty: a hook still loading (or a caller on the older
  // LocationSection shape) must never crash the whole drawer on a .map (VAC-VESTIGING-1).
  const { editing, setEditing, form, setF, save, cancel, branchId, setBranchId } = location
  const provinces = location.provinces ?? []
  const branchOptions = location.branchOptions ?? []
  const { text } = makeFieldHelpers(form, setF, t)
  // VAC-COUNTRY-1 (Danny 22-07, punt 2): fixed ISO-3166 code list, localized to the
  // current UI language — never a tenant lookup (mirrors the candidate's country field).
  const countryOptions = getCountryOptions(i18n.language)

  return card(t('details.groups.location'), <>
    {/* V9: address — each field its OWN labelled row when editing, mirroring the
        candidate ProfileAddressTab canon exactly (street / houseNumber /
        houseNumberSuffix / postalCode / city as five separate rows, never a
        houseNumber+suffix pair squeezed onto one row); read mode still shows
        one composed line (street+no-suffix, postcode+city). */}
    {editing ? (
      <>
        {row(t('details.street'), null, text('street'), editing)}
        {row(t('details.houseNumber'), null, text('houseNumber'), editing)}
        {row(t('details.houseNumberSuffix'), null, text('houseNumberSuffix'), editing)}
        {row(t('details.postalCode'), null, text('postalCode'), editing)}
        {row(t('details.city'), null, text('city'), editing)}
      </>
    ) : (
      row(t('details.address'), composeAddress(v.street, v.houseNumber, v.houseNumberSuffix, v.postalCode, v.city) || v.location || dash, null, editing)
    )}
    {/* VAC-COUNTRY-1: land→provincie cascade, mirroring the candidate ProfileTab/
        AddCandidateModal pattern exactly — both are pick-only (allowCreate=false)
        searchable dropdowns; the province list scopes to the picked country
        (useProvinces(form.country) in the hook), and an already-filled province
        that no longer exists in the new country's list is cleared automatically.
        Read-mode resolves the country's display name, never the bare ISO code.
        VAC-CLEAR-1 (Danny: "gekozen waarde weer leegmaken"): both fields are
        optional and both persist an empty value for real (`province`/`country`
        are sometimes|nullable server-side, mapped onto location_province/
        location_country), so both carry the clear affordance. */}
    {row(t('details.province'), v.province || dash,
      <CreatableSelect value={form.province || null} onChange={(val: string) => setF('province', val)} allowCreate={false}
        clearable clearLabel={t('details.province')}
        placeholder={t('common:select')} options={provinces.map((p: string) => ({ value: p, label: p }))} />, editing)}
    {row(t('details.country'), v.country ? getCountryName(v.country, i18n.language) : dash,
      <CreatableSelect value={form.country || null} onChange={(val: string) => setF('country', val)} allowCreate={false}
        clearable clearLabel={t('details.country')}
        placeholder={t('common:select')} options={countryOptions} />, editing)}
    {/* VAC-VESTIGING-1: the vacancy's OWN bureau branch (vestiging, location_id)
        — distinct from the country/province cascade above, which is the WORK
        address. Now a real editable relation (mirrors AddVacancyModal's
        PlacementCard — same useLocations() source, same `location_id` key);
        optional, so it carries the clear affordance (VAC-CLEAR-1). */}
    {row(t('modal.fields.branch'), v.branchName || dash,
      <CreatableSelect value={branchId || null} onChange={setBranchId} allowCreate={false}
        clearable clearLabel={t('modal.fields.branch')}
        placeholder={t('common:select')} options={branchOptions.map(o => ({ value: String(o.value), label: o.label }))} />, editing)}
  </>, controls(t, editing, save, cancel, () => setEditing(true)))
}
