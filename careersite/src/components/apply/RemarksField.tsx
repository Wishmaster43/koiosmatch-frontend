import { strings } from '@/strings'

interface RemarksFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
}

// "Vragen of opmerkingen" — a PLAIN textarea, deliberately not the rich-text
// editor: the backend strips all markup on store (HtmlSanitizer::plainText), so
// offering formatting controls here would be a lie about what actually persists.
// Only rendered by the parent when the vacancy's setting is not 'hidden'.
export function RemarksField({ value, onChange, error, required = false }: RemarksFieldProps) {
  return (
    <label className="apply-form__field">
      <span className={required ? 'required-marker' : undefined}>{strings.apply.remarks.label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required || undefined}
        rows={4}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  )
}
