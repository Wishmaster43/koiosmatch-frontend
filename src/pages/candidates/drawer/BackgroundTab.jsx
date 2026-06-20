import { useState } from 'react'
import { ExperienceTab, EducationTab, CertificationsTab, SkillsTab } from './SectionTabs'

/** Background tab — experience, education, certifications, skills. Owns its drafts.
 * add/edit/remove update the local list; persistence follows once the backend
 * exposes the sub-entity endpoints. */
export default function BackgroundTab({ c }) {
  const [experiences, setExperiences] = useState(c.experiences ?? [])
  const [educations,  setEducations]  = useState(c.educations ?? [])
  const [certs,       setCerts]        = useState(c.certifications ?? [])
  const [skills,      setSkills]       = useState(c.skills ?? [])

  // add / edit-at-index / remove-at-index for a given setter.
  const ops = (set) => ({
    onAdd:    v      => set(p => [...p, v]),
    onEdit:   (i, v) => set(p => p.map((x, idx) => idx === i ? { ...x, ...v } : x)),
    onRemove: i      => set(p => p.filter((_, idx) => idx !== i)),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ExperienceTab     items={experiences} {...ops(setExperiences)} />
      <EducationTab      items={educations}  {...ops(setEducations)} />
      <CertificationsTab items={certs}       {...ops(setCerts)} />
      <SkillsTab         items={skills}      {...ops(setSkills)} />
    </div>
  )
}
