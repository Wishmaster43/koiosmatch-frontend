import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { FormLabel } from '@/components/ui/typography'
import { FIELD_FONT_SIZE } from '@/components/forms/fieldMetrics'

// Shared face of the public auth inputs (login, reset, invitation), moved verbatim from the login page.
const fieldStyle = (padding: string) => ({
  padding, border: '1px solid var(--border)', outline: 'none', fontSize: FIELD_FONT_SIZE, color: 'var(--text)', background: 'var(--input-bg)',
})

interface AuthTextFieldProps {
  id: string
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  autoComplete?: string
}

// Labelled text/e-mail input with the login page's exact look and focus border swap.
export function AuthTextField({ id, label, type = 'text', value, onChange, placeholder, required, autoFocus, autoComplete }: AuthTextFieldProps) {
  return (
    <div>
      <FormLabel htmlFor={id} style={{ display: 'block', marginBottom: 6 }}>{label}</FormLabel>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} autoFocus={autoFocus} autoComplete={autoComplete}
        className="w-full rounded-lg"
        style={fieldStyle('10px 12px')}
        onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
    </div>
  )
}

interface AuthPasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  showLabel: string
  hideLabel: string
}

// Labelled password input with the in-field eye toggle (show/hide labels come translated from the caller).
export function AuthPasswordField({ id, label, value, onChange, placeholder, required, autoComplete, showLabel, hideLabel }: AuthPasswordFieldProps) {
  const [showPw, setShowPw] = useState(false)
  return (
    <div>
      <FormLabel htmlFor={id} style={{ display: 'block', marginBottom: 6 }}>{label}</FormLabel>
      <div className="relative">
        <input id={id} type={showPw ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required} autoComplete={autoComplete}
          className="w-full rounded-lg"
          style={fieldStyle('10px 40px 10px 12px')}
          onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
        {/* eslint-disable huisstijlLegacy/no-restricted-syntax -- field-internal chrome (BUTTON-GRENS): the eye lives INSIDE the input's box; Button's 28px square would not sit in the field padding (block form: the reported node is the multi-line style attribute) */}
        <button type="button" onClick={() => setShowPw(v => !v)}
          title={showPw ? hideLabel : showLabel}
          aria-label={showPw ? hideLabel : showLabel}
          className="absolute -translate-y-1/2 right-3 top-1/2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
      </div>
    </div>
  )
}
