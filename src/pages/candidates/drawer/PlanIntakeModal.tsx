/**
 * PlanIntakeModal — THE shared appointment modal: "+ Intake plannen" from the
 * candidate Match tab, but also reused from the application drawer's Afspraken
 * tab and the vacancy drawer's applicant list (one create+edit experience
 * everywhere — no more per-surface hand-rolled composers). Picking an
 * appointment TYPE proposes its duration + modality (overridable); the default
 * time is today rounded UP to the next quarter (nobody books 08:03 — it becomes
 * 08:15). The vacancy is OPTIONAL — empty makes the backend create the Intake
 * application (CONSIST-2). On success the host reloads.
 *
 * S24a (Danny 16-07): the panel no longer scrolls itself (see planIntake/styles'
 * `panel` — root-caused the clipped vacancy dropdown); the end time is shown live
 * next to Duur; the appointment TYPE and the "where" picker both preselect their
 * tenant `is_default` entry; the recruiter defaults to the logged-in user; and the
 * vacancy proposal never falls back to a raw id while its title is in flight.
 *
 * AXIS-MATRIX-2 (CMFE audit R1): wires the shared action-rule preflight for
 * `appointment.create` (mirrors MatchPlacementModal's match.create) — CREATE only,
 * since the backend's own guard (AppointmentController::store) only runs on create,
 * never on the PATCH edit path. A warn cell shows an inline banner and still lets
 * the recruiter proceed; a block cell additionally disables the submit button.
 *
 * INTAKE-VACANCY-ID-1 (CMBE VAC-LEADS-1, 22-07): the backend's vacancy leads-list
 * (`GET /vacancies/{id}/leads`) is computed from intake appointments carrying
 * `vacancy_id` — this modal already threads it whenever a caller passes
 * `defaultVacancyId` (application drawer → `application.vacancyId`; vacancy
 * drawer's applicant list → the vacancy's own id). The candidate-drawer quick
 * action (WorkTab, no application context) now defaults it too, but only when
 * the candidate's applications resolve to exactly ONE distinct vacancy —
 * otherwise it stays empty and this picker decides (see WorkTab.tsx).
 *
 * This is a thin container (mirrors MatchPlacementModal, the sibling reference
 * shape): all state/effects/submit/422-mapping live in `planIntake/
 * usePlanIntakeForm`, the pure date/name/error-key helpers in `planIntake/
 * helpers` and the panel/field styling in `planIntake/styles`. What is left here
 * is the ONE form this modal renders — deliberately not split further into
 * per-row section components, since each would need most of the form threaded
 * through it as props to exist (CLAUDE.md §3: single-purpose, not line-count).
 */
import { X } from 'lucide-react'
import SelectMenu from '@/components/ui/SelectMenu'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { ActionRuleBanner } from '@/components/actionrules'
import { usePlanIntakeForm } from './planIntake/usePlanIntakeForm'
import type { PlanIntakeFormOptions } from './planIntake/usePlanIntakeForm'
import { overlay, panel, fieldLabel, input, fieldFootprint, errMsg } from './planIntake/styles'

// Re-exported from their new homes so every caller/test keeps importing them from
// this module (WorkTab + AppointmentsTab take the type, the unit test the helper).
export type { ExistingAppointment } from './planIntake/usePlanIntakeForm'
export { endTimeOf } from './planIntake/helpers'

export default function PlanIntakeModal(props: PlanIntakeFormOptions) {
  const { onClose } = props
  // All state, effects, submit + 422-mapping live in the hook — this component
  // only wires it to the shared chrome and renders the form below.
  const form = usePlanIntakeForm(props)
  const { t, errors, heading } = form
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={heading} tabIndex={-1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{heading}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before scheduling (create only). */}
        {form.apptRuleDecision && form.apptRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 14 }}><ActionRuleBanner decision={form.apptRuleDecision} /></div>
        )}

        {/* Type → proposes duration + modality. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>{t('work.appointmentType')}</div>
          <SelectMenu style={fieldFootprint} value={form.type || null} onChange={form.pickType} placeholder={t('work.pickType')}
            options={form.typeOptions.map(x => ({ value: x.value, label: x.label }))} />
          {errors.type && <div style={errMsg}>{t('common:required')}</div>}
        </div>

        {/* Date/time (default = today, rounded up to the quarter) + duration override
            + the live-computed end time (S24a-b) so "tot 22:15" needs no mental maths. */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="intake-when" style={fieldLabel as React.CSSProperties}>{t('work.intakeWhen')}</label>
            <input id="intake-when" type="datetime-local" value={form.when} onChange={e => form.setWhen(e.target.value)} style={input} />
            {errors.when && <div style={errMsg}>{t('common:required')}</div>}
          </div>
          <div style={{ width: 90 }}>
            <label htmlFor="intake-dur" style={fieldLabel as React.CSSProperties}>{t('work.duration')}</label>
            <input id="intake-dur" type="number" min={5} max={480} step={5} value={form.duration}
              onChange={e => form.setDuration(Number(e.target.value) || 0)} style={input} />
            {errors.duration && <div style={errMsg}>{t('common:required')}</div>}
          </div>
          <div style={{ width: 110 }}>
            <div style={fieldLabel}>{t('work.endTime')}</div>
            {/* Read-only display, not an input — still box-modeled like one (padding +
                transparent border, S24c) so it lines up with When/Duur in the same row. */}
            {/* Read-only but BOXED like its row-mates — the floating "tot 19:15"
                text read as broken layout (Danny 24-07). */}
            <div style={{ padding: '8px 11px', border: '1px solid var(--border)', background: 'var(--hover-bg)', borderRadius: 8, boxSizing: 'border-box', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 13, color: form.endTime ? 'var(--text)' : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {form.endTime ? t('work.endTimeAt', { time: form.endTime }) : '—'}
            </div>
          </div>
        </div>

        {/* Office / remote / phone / a real tenant location, + recruiter. */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>{t('work.modality')}</div>
            {/* Searchable (Danny 24-07: "Locatie ook!!") — same modal combobox as the rest. */}
            <CreatableSelect style={fieldFootprint} value={form.whereValue || null} onChange={form.pickWhere}
              allowCreate={false} options={form.whereOptions} menuWidth={260} />
            {(errors.modality || errors.locationId || errors.appointmentLocation) && <div style={errMsg}>{t('common:required')}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>{t('work.owner')}</div>
            {/* Searchable (Danny 24-07: "recruiter zoekbare dropdown!"). */}
            <CreatableSelect style={fieldFootprint} value={form.ownerId || null} onChange={form.setOwnerId} allowCreate={false} placeholder={t('work.pickOwner')} menuWidth={260}
              options={form.ownerOptions} />
            {errors.ownerId && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* Vacancy optional — searchable pick-only combobox; empty = vacancy-less intake application. */}
        <div style={{ marginBottom: 20 }}>
          <div style={fieldLabel}>{t('work.vacancyOptional')}</div>
          <CreatableSelect value={form.vacancyId || null} onChange={form.setVacancyId} placeholder={t('work.noVacancy')}
            allowCreate={false} menuWidth={340} style={fieldFootprint}
            options={[
              ...form.vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label })),
              ...(form.vacancyFallback ? [form.vacancyFallback] : []),
            ]} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{form.vacancyHint}</div>
          {(errors.vacancyId || errors.applicationId) && <div style={errMsg}>{t('common:required')}</div>}
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {form.submitErr && (
          <div role="alert" style={{ marginBottom: 14, padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {form.submitErr}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          {/* Disabled when `when` OR `type` is missing (no hardcoded type fallback —
              a tenant with zero configured appointment types has nothing valid to
              submit, mirrors the existing `when`-empty gate). */}
          <button onClick={form.submit} disabled={form.saving || !form.when || !form.type || form.apptRuleBlocked}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: (form.when && form.type && !form.apptRuleBlocked) ? 'pointer' : 'default', opacity: (form.when && form.type && !form.apptRuleBlocked) ? 1 : 0.4 }}>
            {form.saving ? t('common:saving') : form.submitLabel}
          </button>
        </div>
      </div>
    </>
  )
}
