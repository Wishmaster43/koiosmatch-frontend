import { useEffect, useState } from 'react'
import { strings } from '../../strings'

interface PhotoFieldProps {
  photo: File | null
  onFileChange: (file: File | null) => void
  error?: string
  required?: boolean
}

// Profile-photo upload — the parent only mounts this when the vacancy's setting
// is not 'hidden' (AVG: never ask for a photo unless explicitly opted in). Dumb:
// type/size validation lives in the parent (mirrors the existing CV field
// pattern), this component only renders the input, a preview thumbnail, remove
// button and the AVG note line.
export function PhotoField({ photo, onFileChange, error, required = false }: PhotoFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Builds (and revokes) an object URL for the thumbnail whenever the selected file changes.
  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  return (
    <div className="apply-form__field">
      {/* The remove button/preview live OUTSIDE the <label> on purpose: a nested
          interactive control inside a <label> risks the browser forwarding its
          click to the associated file input and re-opening the file picker. */}
      <label className="apply-form__field">
        <span className={required ? 'required-marker' : undefined}>{strings.apply.photo.label}</span>
        <input
          // Keyed on presence so removing the file (via the button below, not a user
          // re-pick) actually clears the native input's displayed filename too — file
          // inputs are uncontrolled and never react to a React-only value change.
          key={photo ? 'selected' : 'empty'}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          aria-required={required || undefined}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {previewUrl ? (
        <div className="photo-field__preview">
          <img src={previewUrl} alt={strings.apply.photo.previewAlt} className="photo-field__thumb" />
          <button type="button" className="btn btn--secondary" onClick={() => onFileChange(null)}>
            {strings.apply.photo.removeLabel}
          </button>
        </div>
      ) : null}
      <span className="apply-form__hint">{strings.apply.photo.avgNote}</span>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
