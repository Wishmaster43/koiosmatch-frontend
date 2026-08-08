/**
 * RequiredFieldsGroup — one collapsible block of BUILT-IN candidate fields as a
 * field × phase toggle matrix. Keeps the table shape the customer editor already uses
 * (CustomerPhaseRequiredFieldsMatrix) so both required-fields screens read identically;
 * the only addition is the collapsible shell, which the ~30-field candidate catalog needs.
 *
 * Purely presentational: membership and persistence stay in the container, so this file
 * has no knowledge of the settings blob (§3 container/presentational split).
 */
import { useTranslation } from 'react-i18next'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'
import CollapsibleFieldsBlock from './CollapsibleFieldsBlock'
import type { CandidateRequiredFieldGroup } from './requiredFieldsCatalog'

/** One phase column, narrowed from the tenant lookup item. */
export interface PhaseColumn { value: string; label: string }

export default function RequiredFieldsGroup({ group, phases, isRequired, onToggle, open, onOpenToggle }: {
  group: CandidateRequiredFieldGroup
  phases: PhaseColumn[]
  isRequired: (phase: string, field: string) => boolean
  onToggle: (phase: string, field: string) => void
  open: boolean
  onOpenToggle: () => void
}) {
  const { t } = useTranslation(['settings', 'candidates'])

  // Counter semantics: a field counts once when it is required in ANY phase, so the
  // header reads as "how much of this block is in play" regardless of phase count.
  const requiredCount = group.fields.filter(f => phases.some(p => isRequired(p.value, f.key))).length

  const cell = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'center' as const }
  return (
    <CollapsibleFieldsBlock title={t(group.titleKey)} requiredCount={requiredCount} total={group.fields.length}
      open={open} onToggle={onOpenToggle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{t('requiredFields.field')}</th>
              {phases.map(p => (
                <th key={p.value} style={{ ...cell, fontWeight: 600, color: 'var(--text)' }}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.fields.map(f => (
              <tr key={f.key}>
                <td style={{ ...cell, textAlign: 'left', color: 'var(--text)' }}>{t(f.labelKey)}</td>
                {phases.map(p => (
                  <td key={p.value} style={cell}>
                    {/* Toggle, never a checkbox (Danny 28-07: "GEEN VINKJES MAAR TOGGLES!!!"). */}
                    <PermissionToggle checked={isRequired(p.value, f.key)} onChange={() => onToggle(p.value, f.key)}
                      aria-label={`${t(f.labelKey)} — ${p.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleFieldsBlock>
  )
}
