import { strings } from '../../strings'

export interface AddressFieldsValues {
  street: string
  houseNumber: string
  postcode: string
  city: string
}

interface AddressFieldsProps {
  values: AddressFieldsValues
  onChange: (patch: Partial<AddressFieldsValues>) => void
}

// Address block (CAREERSITE-APPLY-2) — always optional, never settings-gated:
// the backend only fills BLANK candidate fields, so there is no "required" case.
export function AddressFields({ values, onChange }: AddressFieldsProps) {
  return (
    <fieldset className="apply-form__fieldset">
      <legend className="apply-form__section-title">{strings.apply.address.sectionTitle}</legend>

      <div className="apply-form__row">
        <label className="apply-form__field">
          <span>{strings.apply.address.street}</span>
          <input value={values.street} onChange={(event) => onChange({ street: event.target.value })} />
        </label>

        <label className="apply-form__field">
          <span>{strings.apply.address.houseNumber}</span>
          <input value={values.houseNumber} onChange={(event) => onChange({ houseNumber: event.target.value })} />
        </label>
      </div>

      <div className="apply-form__row">
        <label className="apply-form__field">
          <span>{strings.apply.address.postcode}</span>
          <input value={values.postcode} onChange={(event) => onChange({ postcode: event.target.value })} />
        </label>

        <label className="apply-form__field">
          <span>{strings.apply.address.city}</span>
          <input value={values.city} onChange={(event) => onChange({ city: event.target.value })} />
        </label>
      </div>
    </fieldset>
  )
}
