import { useState } from 'react'
import type { ComponentType, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { ExperienceTab as ExperienceTabJs, EducationTab as EducationTabJs, CertificationsTab as CertificationsTabJs, SkillsTab as SkillsTabJs } from './SectionTabs'
import LanguagesSection from './LanguagesSection'
import type { Candidate } from '@/types/candidate'

type RelItem = Record<string, unknown>
type RelTabProps = { items?: RelItem[]; onAdd?: (v: RelItem) => void; onEdit?: (i: number, v: RelItem) => void; onRemove?: (i: number) => void }

// SectionTabs is still untyped JS — declare the relation-list props used here.
const ExperienceTab     = ExperienceTabJs     as ComponentType<RelTabProps>
const EducationTab      = EducationTabJs      as ComponentType<RelTabProps>
const CertificationsTab = CertificationsTabJs as ComponentType<RelTabProps>
const SkillsTab         = SkillsTabJs         as ComponentType<RelTabProps>

/**
 * Background tab — experience, education, certifications, skills.
 *
 * Each list is optimistic local state that also persists to the candidate's
 * sub-entity routes (POST/PATCH/DELETE /candidates/{id}/{relation}). New items
 * get a negative temp id until the POST returns the server id; edit/remove only
 * hit the API once a real (positive numeric) id exists. All calls fail soft.
 */
const TO_API: Record<string, (v: RelItem) => Record<string, unknown>> = {
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

export default function BackgroundTab({ c, onEditSave }: { c: Candidate; onEditSave?: (v: Record<string, unknown>) => void }) {
  const [experiences, setExperiences] = useState<RelItem[]>(c.experiences ?? [])
  const [educations,  setEducations]  = useState<RelItem[]>(c.educations ?? [])
  const [certs,       setCerts]        = useState<RelItem[]>(c.certifications ?? [])
  // Candidate.skills is string[] from the mapper, but the SkillsTab edits them as
  // { name, level } objects (it renders both) — widen to the relation-item shape.
  const [skills,      setSkills]       = useState<RelItem[]>((c.skills ?? []) as unknown as RelItem[])
  const { t } = useTranslation('common')

  // add / edit-at-index / remove-at-index for a relation, with optimistic persistence.
  // Not-yet-persisted rows get a negative temp id (never collides with server ids).
  const ops = (rel: string, list: RelItem[], set: Dispatch<SetStateAction<RelItem[]>>) => ({
    onAdd: (v: RelItem) => {
      const id = -Date.now()
      set(p => [...p, { ...v, id }])
      api.post(`/candidates/${c.id}/${rel}`, TO_API[rel](v))
        .then(r => { const it = r?.data?.data ?? r?.data; if (it?.id) set(p => p.map(x => x.id === id ? { ...v, ...it } : x)) })
        .catch(() => notifyError(t('actionFailed')))
    },
    onEdit: (i: number, v: RelItem) => {
      const id = list[i]?.id
      set(p => p.map((x, idx) => idx === i ? { ...x, ...v } : x))
      if (typeof id === 'number' && id > 0) api.patch(`/candidates/${c.id}/${rel}/${id}`, TO_API[rel](v)).catch(() => notifyError(t('actionFailed')))
    },
    onRemove: (i: number) => {
      const id = list[i]?.id
      set(p => p.filter((_, idx) => idx !== i))
      if (typeof id === 'number' && id > 0) api.delete(`/candidates/${c.id}/${rel}/${id}`).catch(() => notifyError(t('actionFailed')))
    },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ExperienceTab     items={experiences} {...ops('experiences', experiences, setExperiences)} />
      <EducationTab      items={educations}  {...ops('educations', educations, setEducations)} />
      <CertificationsTab items={certs}       {...ops('certifications', certs, setCerts)} />
      <SkillsTab         items={skills}      {...ops('skills', skills, setSkills)} />
      {/* Languages moved here from the Profile tab — persists via the drawer's onUpdate. */}
      <LanguagesSection c={c} onEditSave={onEditSave} />
    </div>
  )
}
