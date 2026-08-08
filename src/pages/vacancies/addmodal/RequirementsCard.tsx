/**
 * RequirementsCard — Functie-eisen: senioriteit + opleiding (punt 14, PARTIAL —
 * NO ervaring-min/max range: StoreVacancyRequest has no such field (measured:
 * zero hits for experience_min_years/experience_max_years in app/ + database/,
 * filed as a CMBE ticket) — adding a range picker here would be a fake
 * affordance §3 forbids) + the required-skills list (punt 15, vertical list +
 * quick-add mirroring DetailsRequirementsTab).
 */
import { useTranslation } from 'react-i18next'
import { X, Plus } from 'lucide-react'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

interface Level { value: string; label: string }
interface Props {
  seniority: string; onSeniorityChange: (v: string) => void; seniorityLevels: Level[]
  education: string; onEducationChange: (v: string) => void; educationLevels: Level[]
  skills: string[]; newSkill: string; onNewSkillChange: (v: string) => void
  onAddSkill: () => void; onRemoveSkill: (s: string) => void
}

export default function RequirementsCard({
  seniority, onSeniorityChange, seniorityLevels, education, onEducationChange, educationLevels,
  skills, newSkill, onNewSkillChange, onAddSkill, onRemoveSkill,
}: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('details.groups.requirements')}</div>
      <div style={cardBox}>
        <div style={row2}>
          <Field label={t('details.seniority')}>
            <CreatableSelect value={seniority || null} onChange={onSeniorityChange} allowCreate={false}
              placeholder={t('common:select')} options={seniorityLevels} />
          </Field>
          <Field label={t('details.education')}>
            <CreatableSelect value={education || null} onChange={onEducationChange} allowCreate={false}
              placeholder={t('common:select')} options={educationLevels} />
          </Field>
        </div>
        {/* Required skills — free strings, vertical list + quick-add (mirrors
            DetailsRequirementsTab.tsx:42-61). */}
        <Field label={t('details.skills')}>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextField value={newSkill} onChange={onNewSkillChange} placeholder={t('details.addSkill')} />
            <button type="button" onClick={onAddSkill} title={t('details.addSkill')}
              style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: 'pointer', flexShrink: 0 }}>
              <Plus size={14} />
            </button>
          </div>
        </Field>
        {skills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skills.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)',
                padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <span style={{ flex: 1, minWidth: 0 }}>{s}</span>
                <button type="button" onClick={() => onRemoveSkill(s)} aria-label={t('common:remove')} title={t('common:remove')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
