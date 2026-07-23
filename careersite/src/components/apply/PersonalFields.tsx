import { strings } from '../../strings'
import { COUNTRY_CODES } from './countryCodes'

export interface PersonalFieldsValues {
  firstName: string
  lastName: string
  email: string
  countryCode: string
  phone: string
}

export interface PersonalFieldsErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

interface PersonalFieldsProps {
  values: PersonalFieldsValues
  errors: PersonalFieldsErrors
  onChange: (patch: Partial<PersonalFieldsValues>) => void
}

// Name + contact block: first/last name render side-by-side from 560px up
// (stacked below on mobile), email, and a phone field paired with a
// dependency-free EU country-code picker whose dial code is joined into the
// single `phone` payload field by the parent on submit.
export function PersonalFields({ values, errors, onChange }: PersonalFieldsProps) {
  return (
    <>
      <div className="apply-form__row">
        <label className="apply-form__field">
          <span className="required-marker">{strings.apply.firstName}</span>
          <input
            value={values.firstName}
            onChange={(event) => onChange({ firstName: event.target.value })}
            aria-required="true"
          />
          {errors.firstName ? <span className="field-error">{errors.firstName}</span> : null}
        </label>

        <label className="apply-form__field">
          <span className="required-marker">{strings.apply.lastName}</span>
          <input
            value={values.lastName}
            onChange={(event) => onChange({ lastName: event.target.value })}
            aria-required="true"
          />
          {errors.lastName ? <span className="field-error">{errors.lastName}</span> : null}
        </label>
      </div>

      <label className="apply-form__field">
        <span className="required-marker">{strings.apply.email}</span>
        <input
          type="email"
          value={values.email}
          onChange={(event) => onChange({ email: event.target.value })}
          aria-required="true"
        />
        {errors.email ? <span className="field-error">{errors.email}</span> : null}
      </label>

      {/* Not wrapped in one shared <label>: it contains two controls (select + input),
          so each gets its own aria-label instead of relying on implicit label wrapping. */}
      <div className="apply-form__field">
        <span className="required-marker">{strings.apply.phone}</span>
        <div className="phone-field">
          <select
            className="phone-field__code"
            aria-label={strings.apply.phoneCountryCodeLabel}
            value={values.countryCode}
            onChange={(event) => onChange({ countryCode: event.target.value })}
          >
            {COUNTRY_CODES.map(({ code, dial, flag }) => (
              <option key={code} value={code} title={code}>
                {flag} +{dial}
              </option>
            ))}
          </select>
          <input
            type="tel"
            className="phone-field__local"
            aria-label={strings.apply.phone}
            value={values.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            aria-required="true"
          />
        </div>
        {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
      </div>
    </>
  )
}
