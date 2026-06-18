import { useState } from 'react'
import { ExperienceTab, EducationTab, CertificationsTab, SkillsTab } from './SectionTabs'

/** Background tab — experience, education, certifications, skills. Owns its drafts. */
export default function BackgroundTab({ c }) {
  const [experiences,     setExperiences]     = useState(c.experiences ?? [])
  const [educations,    setEducations]    = useState(c.educations ?? [])
  const [certs,        setCerts]        = useState(c.certifications ?? [])
  const [skills, setSkills] = useState(c.skills ?? [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ExperienceTab        items={experiences}     onAdd={v => setExperiences(p => [...p, v])} />
      <EducationTab       items={educations}    onAdd={v => setEducations(p => [...p, v])} />
      <CertificationsTab items={certs}        onAdd={v => setCerts(p => [...p, v])} />
      <SkillsTab    items={skills} onAdd={v => setSkills(p => [...p, v])} />
    </div>
  )
}
