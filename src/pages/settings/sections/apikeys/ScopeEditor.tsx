/**
 * ScopeEditor — the per-entity access grid (toggle + permission level), shared by
 * the create modal and the Access tab so both render identical rows. Pure and
 * controlled: it renders `value` (an { entity: level } map) and reports edits via
 * onChange — the parent decides when/how to persist. Off = entity absent = no access.
 *
 * The permission-level picker uses the shared SearchSelect (audit finding, §4/§11 —
 * was a bare native <select>), mirroring ApiKeyGeneralTab's own type picker: single-
 * select via closeOnToggle + searchable={false}, disabled forwarded to BOTH
 * SearchSelect's own gate AND the renderTrigger button (mirrors CustomFieldsSettings'
 * field-type picker) so an off row's level control is fully inert, not just dimmed.
 */
import { useTranslation } from 'react-i18next'
import { Toggle } from '@/pages/settings/components/SettingsKit'
import SearchSelect from '@/components/ui/SearchSelect'
import { BodyText } from '@/components/ui/typography'
import { SCOPE_ENTITIES, ACCESS_LEVELS } from './constants'

// The scope map ScopeEditor edits: { entity: accessLevel }; absence = no access.
export type ScopeMap = Record<string, string>
interface ScopeEditorProps {
  value?: ScopeMap
  onChange: (next: ScopeMap) => void
  levelsByEntity?: Record<string, string[]>
}
// SCOPE-LEVEL-READONLY-1: `levelsByEntity` ({ entity: level[] }) is the backend's hint of the
// levels it offers per entity (useScopeEntityLevels); absent or empty = every level, as before.
export default function ScopeEditor({ value = {}, onChange, levelsByEntity = {} }: ScopeEditorProps) {
  const { t } = useTranslation('settings')

  // The levels offered for one entity: the hint filtered to known levels, else all of them.
  // SCOPE-LEVEL-READONLY-2: a hint KEY present with an EMPTY array means "no level offered
  // at all" (no partner route yet) — distinct from an absent key, which keeps every level.
  const offeredFor = (entity: string): string[] => {
    const rawHint = levelsByEntity[entity]
    if (Array.isArray(rawHint) && rawHint.length === 0) return []
    const hint = (rawHint ?? []).filter((lvl) => (ACCESS_LEVELS as string[]).includes(lvl))
    return hint.length ? hint : ACCESS_LEVELS
  }

  // An entity the backend offers no level for at all blocks turning access ON: it can
  // never be toggled on and never posted. A STORED grant on such an entity (a level set
  // before the hint dropped to `[]`) must still be revocable — the toggle stays enabled
  // for that one direction, so an over-broad scope is never stuck on.
  const isDisabled = (entity: string) => offeredFor(entity).length === 0

  // Toggling on defaults to the first offered level (read); toggling off always removes
  // the entity, even when the entity is otherwise disabled (SCOPE-LEVEL-READONLY-2 fix:
  // a stored grant on a since-disabled entity must stay revocable).
  const toggle = (entity: string) => {
    const next = { ...value }
    if (next[entity]) { delete next[entity]; onChange(next); return }
    if (isDisabled(entity)) return
    next[entity] = offeredFor(entity)[0]
    onChange(next)
  }

  // Switch the permission level for an already-enabled entity.
  const setLevel = (entity: string, level: string) => onChange({ ...value, [entity]: level })

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {SCOPE_ENTITIES.map((entity: string, i: number) => {
        const level = value[entity]
        const on = Boolean(level)
        // Disabled only blocks turning ON; an existing grant (`on`) stays toggleable so it
        // can be revoked even after the backend dropped the entity's offered levels to `[]`.
        const disabled = isDisabled(entity) && !on
        // A stored level the hint no longer offers stays pickable, so it is visible and changeable.
        const offered = offeredFor(entity)
        const options = (level && !offered.includes(level) ? [...offered, level] : offered)
        return (
          <div key={entity} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            {/* SCOPE-LEVEL-READONLY-2: an entity with no offered level can't be turned ON — an honest title explains why; a stored grant stays revocable. */}
            <Toggle checked={on} onChange={() => toggle(entity)} disabled={disabled} title={disabled ? t('apiKeys.scopes.noLevelOffered') : undefined} />
            <span style={{ flex: 1, fontSize: 13, color: on ? 'var(--text)' : 'var(--text-muted)', fontWeight: on ? 500 : 400 }}>
              {t(`apiKeys.scopes.${entity}`)}
            </span>
            {/* Herhaal-audit r4 finding 5: SearchSelect's own default single-pick
                trigger face (closeOnToggle, no renderTrigger) — never a hand-painted
                trigger button per call site. triggerAriaLabel keeps the accessible
                name naming the ENTITY ("Candidates"), since the visible text is only
                the picked LEVEL ("Read"). */}
            {options.length === 0 ? (
              // No level offered at all (SCOPE-LEVEL-READONLY-2): an honest muted notice, never a picker.
              <BodyText as="span" style={{ color: 'var(--text-muted)' }} aria-label={t(`apiKeys.scopes.${entity}`)}>
                {t('apiKeys.scopes.noLevelOffered')}
              </BodyText>
            ) : options.length === 1 ? (
              // One offered level = nothing to pick (§3 no fake affordance): the level reads as text.
              <BodyText as="span" style={{ color: on ? 'var(--text)' : 'var(--text-muted)' }} aria-label={t(`apiKeys.scopes.${entity}`)}>
                {t(`apiKeys.level.${options[0]}`)}
              </BodyText>
            ) : (
              <SearchSelect
                options={options.map((lvl) => ({ value: lvl, label: t(`apiKeys.level.${lvl}`) }))}
                selected={[level ?? options[0]]}
                onToggle={(v: string) => setLevel(entity, v)}
                closeOnToggle
                searchable={false}
                disabled={!on}
                triggerLabel={t(`apiKeys.level.${level ?? options[0]}`)}
                triggerAriaLabel={t(`apiKeys.scopes.${entity}`)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
