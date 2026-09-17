/**
 * RequiredFieldsMatrixTable — the field × phase toggle table body shared by
 * every "required fields per phase" editor (candidates' RequiredFieldsGroup,
 * customers' CustomerPhaseRequiredFieldsMatrix): one row per field, one column
 * per tenant phase, a PermissionToggle cell (never a checkbox, Danny 28-07).
 * Only the surrounding shell (collapsible block vs. plain card, header row
 * background) differs per caller — those stay in each file.
 */
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'
import { REQUIRED_FIELDS_CELL } from './requiredFieldsMatrixStyles'

// `requirable`/`reason` are optional so existing callers (a field the guard always
// enforces) are unaffected; a field-inventory row that is not requirable (consent /
// financial / relation / webhook-stamped) renders disabled with its reason visible,
// never hidden (VERPLICHTE-VELDEN-INVENTARIS-1 — Danny wants to SEE what he can't require).
interface Field { key: string; labelKey: string; requirable?: boolean; reason?: string | null }
interface PhaseColumn { value: string; label: string }

export function RequiredFieldsMatrixTable({ fields, phases, isRequired, onToggle, disabled, headerRowStyle }: {
  fields: Field[]
  phases: PhaseColumn[]
  isRequired: (phase: string, field: string) => boolean
  onToggle: (phase: string, field: string) => void
  disabled?: boolean
  headerRowStyle?: CSSProperties
}) {
  const { t } = useTranslation(['settings'])
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={headerRowStyle}>
          <th style={{ ...REQUIRED_FIELDS_CELL, textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{t('requiredFields.field')}</th>
          {phases.map(p => (
            <th key={p.value} style={{ ...REQUIRED_FIELDS_CELL, fontWeight: 600, color: 'var(--text)' }}>{p.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {fields.map(f => {
          // A non-requirable inventory row stays visible but every cell is inert;
          // its reason renders as a hover title on the label cell, never a dot (§16).
          const rowDisabled = disabled || f.requirable === false
          return (
            <tr key={f.key}>
              <td style={{ ...REQUIRED_FIELDS_CELL, textAlign: 'left', color: 'var(--text)' }} title={f.requirable === false ? f.reason ?? undefined : undefined}>
                {t(f.labelKey)}
              </td>
              {phases.map(p => (
                <td key={p.value} style={REQUIRED_FIELDS_CELL}>
                  <PermissionToggle checked={isRequired(p.value, f.key)} onChange={() => onToggle(p.value, f.key)}
                    disabled={rowDisabled} aria-label={`${t(f.labelKey)} — ${p.label}`} />
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
