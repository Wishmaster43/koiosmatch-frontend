import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import AddableSectionJs from '@/components/forms/AddableSection'

type AnyProps = Record<string, unknown>
// AddableSection's TS props type `items` as `{id,...}` relation objects (the
// candidate drawer's shape) — a vacancy required skill is a plain string with
// no id, so this local render passes raw strings through instead. Same escape
// hatch SectionTabs.tsx (candidates) uses for its own legacy string-skill rows.
const AddableSection = AddableSectionJs as unknown as ComponentType<AnyProps>

interface Props {
  skills: string[]
  onAddSkill: (name: string) => void
  onEditSkill: (i: number, name: string) => void
  onRemoveSkill: (name: string) => void
}

/**
 * RequiredSkillsSection — the vacancy's required-skills list, brought onto the
 * SAME add/edit/remove interaction as the candidate drawer's (frozen canon)
 * SkillsTab (SectionTabs.tsx): a "+ Toevoegen"-style trigger reveals an inline
 * add form instead of an always-visible text+button row, and each row gets its
 * own pencil (edit-in-place, same list position) + trash (remove) — never
 * bare X-only removal with no way to rename a row. VACANCY-SKILLS-PARITY-1
 * (Danny 08-08): "Vereiste vaardigheden bij vacature werken anders dan
 * Vaardigheden bij kandidaten" — this reuses the shared `AddableSection` the
 * candidate side already builds on (§3A: extend, never duplicate).
 *
 * Persisted shape is UNCHANGED: the vacancy PATCH still carries a plain
 * `skills: string[]` (buildVacancyPatch) — a vacancy skill has no id/level/
 * document like the candidate's does, so `fields` carries only one free-text
 * `name`, and `editInitial`/`renderItem` wrap/unwrap the plain string at this
 * component's boundary rather than changing what gets persisted.
 */
export default function RequiredSkillsSection({ skills, onAddSkill, onEditSkill, onRemoveSkill }: Props) {
  const { t } = useTranslation('vacancies')
  const fields = [{ key: 'name', label: t('details.addSkill') }]

  return (
    <AddableSection
      title={t('details.skills')}
      emptyText={t('details.skillsEmpty', { defaultValue: 'No required skills yet.' })}
      addLabel={t('details.addSkill')}
      items={skills}
      fields={fields}
      onAdd={(v: { name?: string }) => onAddSkill((v.name ?? '').trim())}
      onEdit={(i: number, v: { name?: string }) => onEditSkill(i, (v.name ?? '').trim())}
      onRemove={(i: number) => onRemoveSkill(skills[i])}
      // A row here is a plain string ("Triage"), but AddForm spreads `initial`
      // onto its field values — wrap it into { name } so the edit form prefills
      // instead of spreading the string's characters onto numeric keys.
      editInitial={(raw: unknown) => ({ name: typeof raw === 'string' ? raw : '' })}
      renderItem={(raw: unknown, i: number, arr: unknown[]) => {
        const name = typeof raw === 'string' ? raw : ''
        // Mirrors the candidate SkillsTab row exactly: dot bullet + name, vertical
        // list with a border-bottom divider between rows (§3B: list, never chips).
        return (
          <div key={`${name}-${i}`} style={{ display: 'flex', gap: 8, padding: '8px 0', paddingRight: 56,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</span>
          </div>
        )
      }}
    />
  )
}
