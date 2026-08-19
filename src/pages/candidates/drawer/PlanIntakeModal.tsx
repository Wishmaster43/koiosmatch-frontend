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
 * tenant `is_default` entry; the recruiter defaults to the candidate's own owner,
 * else the logged-in user (RECRUITER-DEFAULT-1, Danny 05-08 — see usePlanIntakeForm);
 * and the vacancy proposal never falls back to a raw id while its title is in flight.
 *
 * AXIS-MATRIX-2 (CMFE audit R1): wires the shared action-rule preflight for
 * `appointment.create` (mirrors MatchModal's match.create) — CREATE only,
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
 * This is a thin container (mirrors MatchModal, the sibling reference
 * shape): all state/effects/submit/422-mapping live in `planIntake/
 * usePlanIntakeForm`, the pure date/name/error-key helpers in `planIntake/
 * helpers` and the panel/field styling in `planIntake/styles`. What is left here
 * is the ONE form this modal renders — deliberately not split further into
 * per-row section components, since each would need most of the form threaded
 * through it as props to exist (CLAUDE.md §3: single-purpose, not line-count).
 */
import SelectMenu from '@/components/ui/SelectMenu'
import CreatableSelect from '@/components/ui/CreatableSelect'
import KoiosSuggestionBadge from '@/components/ui/KoiosSuggestionBadge'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { ActionRuleBanner } from '@/components/actionrules'
// HUISSTIJL-1: the shared JetBrains Mono atom + the muted-caption atom (identity-only swaps).
import { Mono, Caption } from '@/components/ui/typography'
import { usePlanIntakeForm } from './planIntake/usePlanIntakeForm'
import type { PlanIntakeFormOptions } from './planIntake/usePlanIntakeForm'
import { input, fieldFootprint, errMsg, labelLeftRow, rowLabel, rowField } from './planIntake/styles'
import Button from '@/components/ui/Button'

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

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // remembered position; same 440px footprint as the old panel.
    <FloatingPanel open onClose={onClose} title={heading} ariaLabel={heading}
      persistKey="plan-intake" width={580} maxWidth="92vw" scrollBody={false} bodyStyle={{ padding: 0 }}>

      {/* Fields scroll in their own area so the footer buttons stay pinned and never clip (Danny 13-08). */}
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0, padding: 22 }}>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before scheduling (create only). */}
        {form.apptRuleDecision && form.apptRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 14 }}><ActionRuleBanner decision={form.apptRuleDecision} /></div>
        )}

        {/* P33: every field its own full-width label-left row (canon 120px label). */}
        {/* Type → proposes duration + modality. */}
        <div style={labelLeftRow}>
          <span style={rowLabel}>{t('work.appointmentType')}</span>
          <div style={rowField}>
            <SelectMenu style={fieldFootprint} value={form.type || null} onChange={form.pickType} placeholder={t('work.pickType')}
              options={form.typeOptions.map(x => ({ value: x.value, label: x.label }))} />
            {errors.type && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* Date/time (default = today, rounded up to the quarter). */}
        <div style={labelLeftRow}>
          <label htmlFor="intake-when" style={rowLabel as React.CSSProperties}>{t('work.intakeWhen')}</label>
          <div style={rowField}>
            <input id="intake-when" type="datetime-local" value={form.when} onChange={e => form.setWhen(e.target.value)} style={input} />
            {errors.when && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* Duration override. */}
        <div style={labelLeftRow}>
          <label htmlFor="intake-dur" style={rowLabel as React.CSSProperties}>{t('work.duration')}</label>
          <div style={rowField}>
            <input id="intake-dur" type="number" min={5} max={480} step={5} value={form.duration}
              onChange={e => form.setDuration(Number(e.target.value) || 0)} style={{ ...input, width: 90 }} />
            {errors.duration && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* End time — read-only, still box-modeled (padding + border, S24c) so it
            lines up with the other rows; the floating "tot 19:15" text read as
            broken layout (Danny 24-07), hence the box, now in its own row (P33). */}
        <div style={labelLeftRow}>
          <span style={rowLabel}>{t('work.endTime')}</span>
          {/* HUISSTIJL-1: identical fontFamily/box render (colour stays the same
              live ternary — the atom does not fix a colour). */}
          <Mono as="div" style={{ padding: '8px 11px', border: '1px solid var(--border)', background: 'var(--hover-bg)', borderRadius: 8, boxSizing: 'border-box', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 13, width: 110, color: form.endTime ? 'var(--text)' : 'var(--text-muted)' }}>
            {form.endTime ? t('work.endTimeAt', { time: form.endTime }) : '—'}
          </Mono>
        </div>

        {/* Office / remote / phone / a real tenant location. */}
        <div style={labelLeftRow}>
          <span style={rowLabel}>{t('work.modality')}</span>
          <div style={rowField}>
            {/* Searchable (Danny 24-07: "Locatie ook!!") — same modal combobox as the rest. */}
            <CreatableSelect style={fieldFootprint} value={form.whereValue || null} onChange={form.pickWhere}
              allowCreate={false} options={form.whereOptions} menuWidth={260} />
            {(errors.modality || errors.locationId || errors.appointmentLocation) && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* Recruiter/owner. */}
        <div style={labelLeftRow}>
          <span style={rowLabel}>{t('work.owner')}</span>
          <div style={rowField}>
            {/* Searchable (Danny 24-07: "recruiter zoekbare dropdown!"). */}
            <CreatableSelect style={fieldFootprint} value={form.ownerId || null} onChange={form.setOwnerId} allowCreate={false} placeholder={t('work.pickOwner')} menuWidth={260}
              options={form.ownerOptions} />
            {errors.ownerId && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* Vacancy optional — searchable pick-only combobox; empty = vacancy-less intake application. */}
        <div style={{ ...labelLeftRow, marginBottom: 20 }}>
          <span style={rowLabel}>{t('work.vacancyOptional')}</span>
          <div style={rowField}>
            {/* Clearable (Danny 13-08: 'kan vacature niet leeg maken?') — the hint
                promises 'laat leeg', so the picker must honour letting go: the
                VAC-CLEAR-1 cross clears back to an intake without a vacancy. */}
            <CreatableSelect value={form.vacancyId || null} onChange={form.setVacancyId} placeholder={t('work.noVacancy')}
              clearable clearLabel={t('work.vacancyOptional')}
              allowCreate={false} menuWidth={340} style={fieldFootprint}
              options={[
                ...form.vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label })),
                ...(form.vacancyFallback ? [form.vacancyFallback] : []),
              ]} />
            {/* The badge lives exactly as long as the suggestion: clearing or
                repicking dissolves it — then the value is the recruiter's own. */}
            {props.suggestedVacancyId != null && String(form.vacancyId) === String(props.suggestedVacancyId) && !props.existing
              ? <KoiosSuggestionBadge />
              // HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div.
              : <Caption as="div" style={{ marginTop: 5 }}>{form.vacancyHint}</Caption>}
            {(errors.vacancyId || errors.applicationId) && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {form.submitErr && (
          <div role="alert" style={{ marginBottom: 14, padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {form.submitErr}
          </div>
        )}

      </div>

      {/* Pinned footer — buttons stay visible whatever the content height (Danny 13-08). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Button variant="secondary" onClick={onClose}>{t('common:cancel')}</Button>
          {/* Disabled when `when` OR `type` is missing (no hardcoded type fallback —
              a tenant with zero configured appointment types has nothing valid to
              submit, mirrors the existing `when`-empty gate). */}
          <Button variant="primary" onClick={form.submit} disabled={form.saving || !form.when || !form.type || form.apptRuleBlocked}>
            {form.saving ? t('common:saving') : form.submitLabel}
          </Button>
        </div>
    </FloatingPanel>
  )
}
