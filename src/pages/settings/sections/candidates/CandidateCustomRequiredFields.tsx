/**
 * CandidateCustomRequiredFields — the tenant's OWN candidate fields as a
 * field × phase required matrix, in its own block below the built-in ones.
 *
 * ── Why this block writes somewhere else ───────────────────────────────────────────
 * The backend guard (`App\Services\Candidate\RequiredFieldsGuard`) reads a custom field's
 * requirement from the DEFINITION, not from the `candidate_required_fields` setting:
 *   `$field->required || in_array($phase, $field->required_phases ?? [], true)`
 * So writing a custom-field key into that setting would do exactly nothing — a dead
 * switch (§3, no fake affordances). These toggles therefore PATCH the definition itself
 * (`PATCH /custom-fields/{id}` with `required_phases`), which is the route the backend
 * actually reads. Measured live 2026-08-09 against yesway: the PATCH returns 200 and the
 * value survives a re-read.
 *
 * A field flagged globally `required` is required in EVERY phase by that same expression,
 * so its per-phase toggles are shown on and disabled with an honest note rather than
 * rendered off (which would lie) or silently writable (which would fight the global flag).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { useCustomFields } from '@/lib/useCustomFields'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'
import CollapsibleFieldsBlock from './CollapsibleFieldsBlock'
import type { PhaseColumn } from './RequiredFieldsGroup'
import { Caption } from '@/components/ui/typography'

export default function CandidateCustomRequiredFields({ phases }: { phases: PhaseColumn[] }) {
  const { t } = useTranslation(['settings', 'candidates', 'common'])
  const { allFields, loading, invalidate } = useCustomFields('candidate')
  const [open, setOpen] = useState(true)
  // Locally applied phase sets, so a saved toggle shows immediately — the shared hook
  // caches per tenant+entity and only refetches on a fresh mount.
  const [applied, setApplied] = useState<Record<string, string[]>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The guard checks ACTIVE definitions regardless of visible_in_ui, so this block
  // must mirror that set exactly — not the narrower "shown on the Extra tab" set.
  const fields = allFields.filter(f => f.active)
  const phasesOf = (id: string, fallback: string[]) => applied[id] ?? fallback

  // Toggle one phase on the DEFINITION and persist it there (never in the setting blob).
  const toggle = async (id: string, current: string[], phase: string) => {
    const next = current.includes(phase) ? current.filter(p => p !== phase) : [...current, phase]
    setBusyId(id)
    setError(null)
    try {
      await api.patch(`/custom-fields/${id}`, { required_phases: next })
      setApplied(prev => ({ ...prev, [id]: next }))
      invalidate()
    } catch (err) {
      setError(extractApiError(err, t('requiredFields.customSaveFailed')))
    } finally {
      setBusyId(null)
    }
  }

  const requiredCount = fields.filter(f =>
    f.required_always || phasesOf(String(f.id), f.required_for ?? []).length > 0).length

  const cell = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'center' as const }
  return (
    <CollapsibleFieldsBlock title={t('candidates:drawer.customFields')} requiredCount={requiredCount}
      total={fields.length} open={open} onToggle={() => setOpen(v => !v)}>
      <div style={{ padding: '10px 12px 0' }}>
        {/* Says out loud that these toggles are stored on the field definition — the
            two halves of this screen genuinely save to different places. */}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('requiredFields.customHint')}</p>
        {error && (
          <p role="alert" style={{ fontSize: 12, color: 'var(--color-danger)', margin: '8px 0 0' }}>{error}</p>
        )}
      </div>

      {/* Four states, explicitly (§3): loading · empty · error (above) · success. */}
      {loading && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px' }}>{t('common:loading')}</p>
      )}

      {!loading && fields.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px' }}>
          {t('requiredFields.customEmpty')}
        </p>
      )}

      {!loading && fields.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
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
              {fields.map(f => {
                const id = String(f.id)
                const current = phasesOf(id, f.required_for ?? [])
                return (
                  <tr key={id}>
                    <td style={{ ...cell, textAlign: 'left', color: 'var(--text)' }}>
                      {f.label}
                      {/* Honest note instead of toggles that cannot change anything. */}
                      {f.required_always && (
                        <Caption style={{ display: 'block', fontStyle: 'italic' }}>
                          {t('requiredFields.customAlwaysRequired')}
                        </Caption>
                      )}
                    </td>
                    {phases.map(p => (
                      <td key={p.value} style={cell}>
                        <PermissionToggle checked={f.required_always || current.includes(p.value)}
                          disabled={f.required_always || busyId === id}
                          onChange={() => toggle(id, current, p.value)}
                          aria-label={`${f.label} — ${p.label}`} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleFieldsBlock>
  )
}
