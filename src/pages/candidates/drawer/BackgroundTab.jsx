import { useState } from 'react'
import api from '../../../lib/api'
import { ExperienceTab, EducationTab, CertificationsTab, SkillsTab } from './SectionTabs'

/**
 * Background tab — experience, education, certifications, skills.
 *
 * Each list is optimistic local state that also persists to the candidate's
 * sub-entity routes (POST/PATCH/DELETE /candidates/{id}/{relation}). New items
 * get a negative temp id until the POST returns the server id; edit/remove only
 * hit the API once a real id exists. All calls fail soft (UI never breaks).
 *
 * Body field names (snake_case) — confirm these match the backend columns:
 *   experiences:    function_title, employer, location, start_date, end_date, current, description
 *   educations:     title, school, start_date, end_date, in_progress, description, issue_date
 *   certifications: name, organisation, issue_date, expiry_date, license_number, description
 *   skills:         name, level
 */
const TO_API = {
  experiences: v => ({
    function_title: v.title, employer: v.company, location: v.location,
    start_date: v.start, end_date: v.current ? null : v.end,
    current: !!v.current, description: v.desc,
  }),
  educations: v => ({
    title: v.title, school: v.school, start_date: v.start,
    end_date: v.end, in_progress: !!v.inProgress, description: v.desc, issue_date: v.issued,
  }),
  certifications: v => ({
    name: v.name, organisation: v.org, issue_date: v.issued,
    expiry_date: v.expires, license_number: v.license, description: v.desc,
  }),
  skills: v => ({ name: v.name, level: v.level }),
}

export default function BackgroundTab({ c }) {
  const [experiences, setExperiences] = useState(c.experiences ?? [])
  const [educations,  setEducations]  = useState(c.educations ?? [])
  const [certs,       setCerts]        = useState(c.certifications ?? [])
  const [skills,      setSkills]       = useState(c.skills ?? [])

  // add / edit-at-index / remove-at-index for a relation, with optimistic persistence.
  // Not-yet-persisted rows get a negative temp id (never collides with server ids).
  const ops = (rel, list, set) => ({
    onAdd: (v) => {
      const id = -Date.now()
      set(p => [...p, { ...v, id }])
      api.post(`/candidates/${c.id}/${rel}`, TO_API[rel](v))
        .then(r => { const it = r?.data?.data ?? r?.data; if (it?.id) set(p => p.map(x => x.id === id ? { ...v, ...it } : x)) })
        .catch(() => {})
    },
    onEdit: (i, v) => {
      const id = list[i]?.id
      set(p => p.map((x, idx) => idx === i ? { ...x, ...v } : x))
      if (id > 0) api.patch(`/candidates/${c.id}/${rel}/${id}`, TO_API[rel](v)).catch(() => {})
    },
    onRemove: (i) => {
      const id = list[i]?.id
      set(p => p.filter((_, idx) => idx !== i))
      if (id > 0) api.delete(`/candidates/${c.id}/${rel}/${id}`).catch(() => {})
    },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ExperienceTab     items={experiences} {...ops('experiences', experiences, setExperiences)} />
      <EducationTab      items={educations}  {...ops('educations', educations, setEducations)} />
      <CertificationsTab items={certs}       {...ops('certifications', certs, setCerts)} />
      <SkillsTab         items={skills}      {...ops('skills', skills, setSkills)} />
    </div>
  )
}
