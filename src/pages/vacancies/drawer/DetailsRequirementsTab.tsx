import { useTranslation } from 'react-i18next'
import { X, Plus } from 'lucide-react'
import { row, card, controls, dash, pair, blockStyle, groupTitle, inputStyle, iconBtn, makeFieldHelpers } from './detailsFieldKit'
import type { RequirementsSection } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

interface Level { value: string; label: string }
interface Props {
  vacancy: VacancyDetail
  requirements: RequirementsSection
  seniorityLevels: Level[]
  educationLevels: Level[]
}

/**
 * DetailsRequirementsTab — Eisen sub-tab (VAC-DETAILS-SPLIT-1): ervaring,
 * senioriteit, opleiding, plus the required-skills list. Its OWN pencil/save/
 * cancel (`requirements.*` from the hook) — flipping it never touches
 * Algemeen/Locatie/Voorwaarden's drafts.
 *
 * Skills placement: the list moved here (was a standalone block under the old
 * single-form DetailsTab) because it answers the SAME question as the rest of
 * this card — "what does the job require" — ervaring/senioriteit/opleiding are
 * requirements, and so are the required skills. Its quick-add/remove stays
 * OUTSIDE the pencil (persists immediately), but while THIS tab's pencil is
 * open the change now rides along with the Eisen Save instead of a different
 * tab's — scoping that "ride along" behaviour to the section it visually lives in.
 */
export default function DetailsRequirementsTab({ vacancy: v, requirements, seniorityLevels, educationLevels }: Props) {
  const { t } = useTranslation('vacancies')
  const { editing, setEditing, form, setF, save, cancel, skills, newSkill, setNewSkill, addSkill, removeSkill } = requirements
  const { select, twoInputs } = makeFieldHelpers(form, setF, t)

  return (
    <>
      {card(t('details.groups.requirements'), <>
        {row(t('details.experience'), pair(v.experienceMin, v.experienceMax, t('details.years')) || dash, twoInputs('experienceMin', 'experienceMax', t('details.experienceFrom'), t('details.experienceTo')), editing)}
        {row(t('details.seniority'), v.seniority || dash, select('seniority', seniorityLevels.map(s => ({ value: s.value, label: s.label }))), editing)}
        {row(t('details.education'), v.education || dash, select('education', educationLevels.map(e => ({ value: e.value, label: e.label }))), editing)}
      </>, controls(t, editing, save, cancel, () => setEditing(true)))}

      {/* Required skills — vertical list; quick-add/remove ALWAYS available (saves
          immediately outside edit-mode, rides the Eisen Save while it's open). */}
      <div>
        <div style={groupTitle}>{t('details.skills')}</div>
        {skills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skills.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', padding: '6px 10px', ...blockStyle }}>
                <span style={{ flex: 1, minWidth: 0 }}>{s}</span>
                <button onClick={() => removeSkill(s)} title={t('common:remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSkill() }}
            placeholder={t('details.addSkill')} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addSkill} title={t('details.addSkill')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Plus size={14} /></button>
        </div>
      </div>
    </>
  )
}
