import { useTranslation } from 'react-i18next'
import type { Id } from '@/types/common'

interface DocumentLinkPickerProps {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  educations: Array<{ id?: Id; title?: string }>
  certifications: Array<{ id?: Id; name?: string }>
  // DOC-LANG-SKILL-LINK-1: the same OPTIONAL link, extended to languages/skills
  // (BE landed document_id on candidate_languages + candidate_skills). Optional
  // with an empty-array default so a caller that hasn't threaded these through
  // yet keeps rendering exactly as before (backward compatible prop addition).
  languages?: Array<{ id?: Id; language?: string; name?: string }>
  skills?: Array<{ id?: Id; name?: string }>
}

/**
 * DocumentLinkPicker — the OPTIONAL "Koppelen aan" grouped select used by the
 * document upload queue (DOC-ENTRY-LINK-1): lets a recruiter link a freshly
 * uploaded proof document straight to one of the candidate's educations,
 * certifications, languages or skills (DOC-LANG-SKILL-LINK-1), without leaving
 * the Documenten tab. `value` is a "kind:id" composite string ("education:<id>"
 * / "certification:<id>" / "language:<id>" / "skill:<id>"); '' = no link.
 * Renders nothing when the candidate has none of the four (no fake affordance
 * offering a choice that resolves to nothing).
 */
export default function DocumentLinkPicker({ ariaLabel, value, onChange, educations, certifications, languages = [], skills = [] }: DocumentLinkPickerProps) {
  const { t } = useTranslation('candidates')
  if (educations.length === 0 && certifications.length === 0 && languages.length === 0 && skills.length === 0) return null
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
      {/* DOC-LANG-SKILL-LINK-1: Talen/Vaardigheden groups — same "kind:id" composite. */}
      {languages.length > 0 && (
        <optgroup label={t('sections.languages')}>
          {languages.map(lang => <option key={`lang-${lang.id}`} value={`language:${lang.id}`}>{lang.language ?? lang.name}</option>)}
        </optgroup>
      )}
      {skills.length > 0 && (
        <optgroup label={t('sections.skills')}>
          {skills.map(skill => <option key={`skill-${skill.id}`} value={`skill:${skill.id}`}>{skill.name}</option>)}
        </optgroup>
      )}
    </select>
  )
}
