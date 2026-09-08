/**
 * JsonField — editor for a catalogue `json` setting. The form holds the stored JSON
 * string; the textarea shows it per format (one item / key=value per line, or raw JSON)
 * and commits on blur. An invalid draft stays on screen with an inline alert and is
 * never written back.
 */
import { useEffect, useState } from 'react'
import { TextareaField } from './SettingsKit'
import { Caption } from '@/components/ui/typography'
import { toDraft, fromDraft } from '../catalog/jsonFormat'

export default function JsonField({ value, onChange, format, placeholder, ariaLabel, invalidLabel, disabled = false }) {
  const [draft, setDraft] = useState(() => toDraft(value, format))
  const [invalid, setInvalid] = useState(false)

  // Re-sync the draft when the stored value changes underneath (load, reset).
  useEffect(() => { setDraft(toDraft(value, format)); setInvalid(false) }, [value, format])

  // Parse on blur; only a valid draft reaches the form.
  const commit = () => {
    try {
      onChange(fromDraft(draft, format))
      setInvalid(false)
    } catch {
      setInvalid(true)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 260 }}>
      <TextareaField value={draft} onChange={setDraft} onBlur={commit} placeholder={placeholder}
        minHeight={96} mono disabled={disabled} invalid={invalid} ariaLabel={ariaLabel} />
      {invalid && <Caption role="alert" style={{ color: 'var(--color-danger-text)' }}>{invalidLabel}</Caption>}
    </div>
  )
}
