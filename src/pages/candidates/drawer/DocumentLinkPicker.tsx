import { useTranslation } from 'react-i18next'
import type { Id } from '@/types/common'

interface DocumentLinkPickerProps {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  educations: Array<{ id?: Id; title?: string }>
  certifications: Array<{ id?: Id; name?: string }>
}

/**
 * DocumentLinkPicker — the OPTIONAL "Koppelen aan" grouped select used by the
 * document upload queue (DOC-ENTRY-LINK-1): lets a recruiter link a freshly
 * uploaded proof document straight to one of the candidate's educations or
 * certifications, without leaving the Documenten tab. `value` is a "kind:id"
 * composite string ("education:<id>" / "certification:<id>"); '' = no link.
 * Renders nothing when the candidate has neither (no fake affordance offering
 * a choice that resolves to nothing).
 */
export default function DocumentLinkPicker({ ariaLabel, value, onChange, educations, certifications }: DocumentLinkPickerProps) {
  const { t } = useTranslation('candidates')
  if (educations.length === 0 && certifications.length === 0) return null
  return (
    <select aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)}
      style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }}>
      <option value="">{t('documents.linkTo')}</option>
      {educations.length > 0 && (
        <optgroup label={t('sections.education')}>
          {educations.map(edu => <option key={`edu-${edu.id}`} value={`education:${edu.id}`}>{edu.title}</option>)}
        </optgroup>
      )}
      {certifications.length > 0 && (
        <optgroup label={t('sections.certifications')}>
          {certifications.map(cert => <option key={`cert-${cert.id}`} value={`certification:${cert.id}`}>{cert.name}</option>)}
        </optgroup>
      )}
    </select>
  )
}
