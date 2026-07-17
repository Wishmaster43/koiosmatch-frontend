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
 * S24a (Danny 16-07): the panel no longer scrolls itself (see `panel` below —
 * root-caused the clipped vacancy dropdown); the end time is shown live next to
 * Duur; the appointment TYPE and the "where" picker both preselect their tenant
 * `is_default` entry; the recruiter defaults to the logged-in user; and the
 * vacancy proposal never falls back to a raw id while its title is in flight.
 *
 * AXIS-MATRIX-2 (CMFE audit R1): wires the shared action-rule preflight for
 * `appointment.create` (mirrors MatchPlacementModal's match.create) — CREATE only,
 * since the backend's own guard (AppointmentController::store) only runs on create,
 * never on the PATCH edit path. A warn cell shows an inline banner and still lets
 * the recruiter proceed; a block cell additionally disables the submit button.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import SelectMenu from '@/components/ui/SelectMenu'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useUsers } from '@/lib/queries'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
import type { Modality } from '@/lib/useAppointmentTypes'
import { useAppointmentLocations } from '@/lib/useAppointmentLocations'
import { useLocations } from '@/lib/useLocations'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useActionRulePreflight, ActionRuleBanner } from '@/components/actionrules'
import type { Id } from '@/types/common'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }
// S24a root-cause fix: this panel used to carry `overflowY:'auto', maxHeight:'88vh'`.
// An ancestor with a non-visible `overflow` clips ANY absolutely-positioned descendant
// (CreatableSelect/SelectMenu's dropdown) at the ancestor's own box — regardless of
// z-index — the moment the dropdown's natural height pushes past it. Since this
// modal's content is short (mirrors the unconstrained candidates/drawer/
// AddApplicationModal panel), it never genuinely needs to scroll; dropping the
// scroll container removes the clipping context instead of fighting it with z-index.
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }
const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const errMsg: React.CSSProperties = { fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  scheduled_at: 'when', type: 'type', duration_min: 'duration', modality: 'modality',
  location_id: 'locationId', appointment_location: 'appointmentLocation',
  owner_id: 'ownerId', vacancy_id: 'vacancyId', application_id: 'applicationId',
}

interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string }
const userName = (u: UserLike) => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// Today, rounded UP to the next quarter hour, as a datetime-local value (YYYY-MM-DDTHH:MM).
function defaultWhen(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  const q = 15 - (d.getMinutes() % 15)
  if (q !== 15) d.setMinutes(d.getMinutes() + q)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// S24a(b): the appointment's end time, computed live from `when` + `duration` — shown
// next to Duur so the recruiter sees "tot 22:15" without doing the maths themselves.
// Exported (not just used internally) so the date maths gets a direct unit test
// instead of only an indirect one through i18next's untranslated-key fallback.
export function endTimeOf(whenLocal: string, durationMin: number): string {
  if (!whenLocal) return ''
  const d = new Date(whenLocal)
  if (Number.isNaN(d.getTime())) return ''
  d.setMinutes(d.getMinutes() + (durationMin || 0))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface ExistingAppointment {
  id: Id; scheduled_at?: string; duration_min?: number | null; modality?: string; owner_id?: Id
  type?: string; vacancy_id?: Id | null; location_id?: Id | null; appointment_location?: string | null
}

export default function PlanIntakeModal({
  candidateId, onClose, onCreated, existing, applicationId = null, defaultVacancyId = null, mode = 'intake',
}: {
  candidateId: Id
  onClose: () => void
  onCreated: () => void
  // When present the modal EDITS this appointment (prefill + PATCH) instead of creating.
  existing?: ExistingAppointment
  // Links a newly-created appointment to this application (create only — an edit keeps its original link).
  applicationId?: Id | null
  // Prefills the vacancy select when there is no existing appointment (booking from a vacancy/application).
  defaultVacancyId?: Id | null
  // Generic copy ("Afspraak…") for non-candidate-drawer callers; default keeps the original intake wording.
  mode?: 'intake' | 'appointment'
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const { types, intakeTypes, metaOf } = useAppointmentTypes()
  const { locations: appointmentLocations, defaultLocation } = useAppointmentLocations()
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }
  const vacancyOptions = useVacancyOptions(true)
  // A stored vacancy that is missing from the options (rejected/archived vacancy
  // or beyond the option cap) would render as a raw id in the select (Danny 13/7,
  // sharpened S24a-f) — fetch its title once and inject it as an option; the
  // render-time `vacancyFallback` below covers the id while this is still null.
  const [extraVacancy, setExtraVacancy] = useState<{ value: string; label: string } | null>(null)
  const locationOptions = useLocations()
  // The candidate-drawer intake flow only offers intake-flagged types (unchanged);
  // the generic "appointment" mode (application/vacancy drawers) offers ALL tenant
  // types — most configured types (follow-up, phone call, …) are NOT flagged intake,
  // so restricting to intakeTypes there would make them unreachable.
  const typeOptions = mode === 'appointment' ? types : intakeTypes
  // S24a(c): preselect the tenant's flagged default WITHIN the relevant subset
  // (intake-only vs. all types), falling back to the first option.
  const defaultTypeOption = typeOptions.find(x => x.is_default) ?? typeOptions[0]

  // datetime-local wants "YYYY-MM-DDTHH:MM" — trim an ISO string to that shape.
  const toLocalInput = (iso?: string) => iso ? iso.slice(0, 16) : ''
  const [type, setType] = useState(() => existing?.type ?? defaultTypeOption?.value ?? '')
  const [when, setWhen] = useState(() => existing?.scheduled_at ? toLocalInput(existing.scheduled_at) : defaultWhen())
  // Duration + modality prefill from the existing appointment, else from the type.
  const [duration, setDuration] = useState<number>(() => existing?.duration_min ?? typeOptions[0]?.default_duration_min ?? 30)
  const [modality, setModality] = useState<Modality>(() => (existing?.modality as Modality) ?? typeOptions[0]?.default_modality ?? 'office')
  // A real tenant location (vs. the plain office/remote/phone presets) — empty = none picked.
  const [locationId, setLocationId] = useState(() => existing?.location_id ? String(existing.location_id) : '')
  // S24a(d): the tenant appointment-locations lookup slug (Kantoor/Online/Telefonisch/
  // Bij klant) — replaces the old hardcoded modality-preset labels; preselects is_default.
  const [appointmentLocation, setAppointmentLocation] = useState(() => existing?.appointment_location ?? defaultLocation?.value ?? '')
  const [ownerId, setOwnerId] = useState(() => existing?.owner_id ? String(existing.owner_id) : '')
  const [vacancyId, setVacancyId] = useState(() => {
    if (existing?.vacancy_id) return String(existing.vacancy_id)
    return defaultVacancyId ? String(defaultVacancyId) : ''
  })
  useEffect(() => {
    if (!vacancyId || vacancyOptions.some(v => String(v.value) === String(vacancyId))) { setExtraVacancy(null); return }
    let alive = true
    api.get(`/vacancies/${vacancyId}`, { quiet404: true } as never)
      .then(r => {
        if (!alive) return
        const d = unwrap<{ title?: string }>(r)
        setExtraVacancy({ value: String(vacancyId), label: d?.title ? String(d.title) : t('work.vacancyUnknown') })
      })
      .catch(() => { if (alive) setExtraVacancy({ value: String(vacancyId), label: t('work.vacancyUnknown') }) })
    return () => { alive = false }
  }, [vacancyId, vacancyOptions, t])
  // The vacancy option CreatableSelect falls back to displaying its raw `value` the
  // moment no option matches it — computed HERE (render time), not only inside the
  // effect above, so even the very first paint (before any effect has run) never
  // shows the raw GUID: while `extraVacancy` hasn't resolved yet for this id, fall
  // back to a neutral "loading" label instead of leaving the slot empty.
  const vacancyKnown = Boolean(vacancyId) && vacancyOptions.some(v => String(v.value) === String(vacancyId))
  const vacancyFallback = (vacancyId && !vacancyKnown)
    ? { value: String(vacancyId), label: (extraVacancy && String(extraVacancy.value) === String(vacancyId)) ? extraVacancy.label : t('common:loading') }
    : null
  const [saving, setSaving] = useState(false)
  // 422 field errors (house pattern, mirrors AddCandidateModal/AddCustomerModal) +
  // a non-field fallback banner — replaces the old generic-toast-only handling.
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const editing = !!existing

  // AXIS-MATRIX-2 preflight (mirrors MatchPlacementModal's match.create wiring, the
  // reference implementation): POST /candidates/{id}/appointments enforces
  // appointment.create against the candidate server-side (AppointmentController::
  // store) — surface the same warn/block decision here BEFORE submit. Only relevant
  // on CREATE: the PATCH edit path (AppointmentController::update) never re-runs the
  // guard, so an edit of an already-scheduled appointment is never gated by it.
  const { decision: apptRuleDecisionRaw } = useActionRulePreflight('appointment.create', { candidateId: String(candidateId || '') })
  const apptRuleDecision = editing ? null : apptRuleDecisionRaw
  const apptRuleBlocked = apptRuleDecision?.effect === 'block'

  // S24a(e): default the recruiter to the logged-in user, mirroring AddApplicationModal's
  // meIsAssignable pattern — only on CREATE, and only while nothing is picked yet, so an
  // edit never silently reassigns an appointment away from its stored owner.
  const ownerOptions = users.map(u => ({ value: String(u.id), label: userName(u) }))
  const meIsAssignable = me?.id != null && ownerOptions.some(o => o.value === String(me.id))
  useEffect(() => {
    if (!editing && meIsAssignable && !ownerId) setOwnerId(String(me!.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once meIsAssignable resolves
  }, [meIsAssignable])

  // S24a(c) — measured live (probe found "Kies een type" with no selection): a lazy
  // useState initializer only reads `typeOptions` at MOUNT time, which is still the
  // seed fallback (useCachedLookup resolves the real /appointment-types data a beat
  // later). The seed's own default slug ("intake_flex") isn't a real tenant slug, so
  // once the real data replaces the seed, `type` is left holding a value that matches
  // NOTHING in the new `typeOptions` — SelectMenu then shows its placeholder instead
  // of a selection. Re-sync to the CURRENT default whenever it no longer matches,
  // carrying its duration/modality along too (mirrors pickType); skipped once editing
  // or once the user (or a still-valid earlier default) already holds a real option.
  useEffect(() => {
    if (editing) return
    if (type && typeOptions.some(x => x.value === type)) return
    if (!defaultTypeOption) return
    setType(defaultTypeOption.value)
    setDuration(defaultTypeOption.default_duration_min)
    setModality(defaultTypeOption.default_modality)
    // Loop-safe with `type` in deps: setType makes `type` valid, so the guard no-ops next run.
  }, [defaultTypeOption, typeOptions, editing, type])

  // S24a(d) — the same re-sync for the appointment-location lookup pick. The seed's
  // default ("kantoor") happens to match today's real seed, so this isn't observed
  // live yet, but it must not silently break the moment a tenant's own default differs.
  useEffect(() => {
    if (editing) return
    if (locationId) return // a real branch is picked instead — nothing to resync here
    if (appointmentLocation && appointmentLocations.some(x => x.value === appointmentLocation)) return
    if (!defaultLocation) return
    setAppointmentLocation(defaultLocation.value)
    // Loop-safe with `appointmentLocation` in deps: after the set the guard no-ops.
  }, [defaultLocation, appointmentLocations, editing, locationId, appointmentLocation])

  // Selecting a type re-proposes its duration + modality (the user can still change them);
  // a stale location pick no longer matches a re-proposed remote/phone modality, so clear it.
  const pickType = (v: string) => {
    setType(v)
    const m = metaOf(v)
    if (m) { setDuration(m.default_duration_min); setModality(m.default_modality); setLocationId('') }
  }

  // S24a(b): live end time, recomputed on every date/duration change.
  const endTime = endTimeOf(when, duration)

  // ONE "where" select = the tenant appointment-locations lookup (Kantoor/Online/
  // Telefonisch/Bij klant) + the tenant's real physical branches. Picking a branch
  // sets location_id + forces modality:office (unambiguously on-site); picking a
  // lookup entry sets appointment_location and leaves modality as the TYPE proposed
  // it (the lookup's slugs are tenant-configurable, not a fixed office/remote/phone
  // enum, so there is no safe 1:1 mapping back onto the `modality` column here).
  const LOC_PREFIX = 'loc:'
  const whereValue = locationId ? `${LOC_PREFIX}${locationId}` : appointmentLocation
  const whereOptions = [
    ...appointmentLocations.map(l => ({ value: l.value, label: l.label })),
    ...locationOptions.map(l => ({ value: `${LOC_PREFIX}${l.value}`, label: l.label })),
  ]
  const pickWhere = (v: string) => {
    if (v.startsWith(LOC_PREFIX)) { setLocationId(v.slice(LOC_PREFIX.length)); setAppointmentLocation(''); setModality('office') }
    else { setLocationId(''); setAppointmentLocation(v) }
  }

  // Book the appointment; vacancy_id optional (BE auto-creates the intake application when
  // there is none). application_id only on create — an edit keeps its original link.
  const submit = async () => {
    if (!when) return
    setSaving(true)
    setErrors({}); setSubmitErr(null)
    const body = {
      scheduled_at: when, type: type || 'intake', duration_min: duration, modality,
      location_id: locationId || null,
      appointment_location: appointmentLocation || null,
      ...(ownerId ? { owner_id: ownerId } : {}),
      ...(vacancyId ? { vacancy_id: vacancyId } : {}),
      ...(!editing && applicationId ? { application_id: applicationId } : {}),
    }
    try {
      if (editing) await api.patch(`/candidates/${candidateId}/appointments/${existing.id}`, body)
      else         await api.post(`/candidates/${candidateId}/appointments`, body)
      notifySuccess(t(editing ? 'work.intakeUpdated' : 'work.intakePlanned'))
      onCreated(); onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one) so the user isn't left guessing.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setSubmitErr(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    } finally { setSaving(false) }
  }

  // Generic ("Afspraak…") vs the original intake-specific header/button copy.
  const heading = editing
    ? t(mode === 'appointment' ? 'work.editAppointment' : 'work.editIntake')
    : t(mode === 'appointment' ? 'work.planAppointment' : 'work.planIntake')
  const submitLabel = editing ? t('common:save') : t(mode === 'appointment' ? 'work.createAppointment' : 'work.createIntake')
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
        {apptRuleDecision && apptRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 14 }}><ActionRuleBanner decision={apptRuleDecision} /></div>
        )}

        {/* Type → proposes duration + modality. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>{t('work.appointmentType')}</div>
          <SelectMenu value={type || null} onChange={pickType} placeholder={t('work.pickType')}
            options={typeOptions.map(x => ({ value: x.value, label: x.label }))} />
          {errors.type && <div style={errMsg}>{t('common:required')}</div>}
        </div>

        {/* Date/time (default = today, rounded up to the quarter) + duration override
            + the live-computed end time (S24a-b) so "tot 22:15" needs no mental maths. */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="intake-when" style={fieldLabel as React.CSSProperties}>{t('work.intakeWhen')}</label>
            <input id="intake-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={input} />
            {errors.when && <div style={errMsg}>{t('common:required')}</div>}
          </div>
          <div style={{ width: 90 }}>
            <label htmlFor="intake-dur" style={fieldLabel as React.CSSProperties}>{t('work.duration')}</label>
            <input id="intake-dur" type="number" min={5} max={480} step={5} value={duration}
              onChange={e => setDuration(Number(e.target.value) || 0)} style={input} />
            {errors.duration && <div style={errMsg}>{t('common:required')}</div>}
          </div>
          <div style={{ width: 90 }}>
            <div style={fieldLabel}>{t('work.endTime')}</div>
            <div style={{ height: 36, display: 'flex', alignItems: 'center', fontSize: 13, color: endTime ? 'var(--text)' : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {endTime ? t('work.endTimeAt', { time: endTime }) : '—'}
            </div>
          </div>
        </div>

        {/* Office / remote / phone / a real tenant location, + recruiter. */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>{t('work.modality')}</div>
            <SelectMenu value={whereValue || null} onChange={pickWhere} options={whereOptions} />
            {(errors.modality || errors.locationId || errors.appointmentLocation) && <div style={errMsg}>{t('common:required')}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>{t('work.owner')}</div>
            <SelectMenu value={ownerId || null} onChange={setOwnerId} placeholder={t('work.pickOwner')}
              options={users.map(u => ({ value: String(u.id), label: userName(u) }))} />
            {errors.ownerId && <div style={errMsg}>{t('common:required')}</div>}
          </div>
        </div>

        {/* Vacancy optional — searchable pick-only combobox; empty = vacancy-less intake application. */}
        <div style={{ marginBottom: 20 }}>
          <div style={fieldLabel}>{t('work.vacancyOptional')}</div>
          <CreatableSelect value={vacancyId || null} onChange={setVacancyId} placeholder={t('work.noVacancy')}
            allowCreate={false} menuWidth={340}
            options={[
              ...vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label })),
              ...(vacancyFallback ? [vacancyFallback] : []),
            ]} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{t(mode === 'appointment' ? 'work.appointmentVacancyHint' : 'work.intakeVacancyHint')}</div>
          {(errors.vacancyId || errors.applicationId) && <div style={errMsg}>{t('common:required')}</div>}
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {submitErr && (
          <div role="alert" style={{ marginBottom: 14, padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
            {submitErr}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={submit} disabled={saving || !when || apptRuleBlocked}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: (when && !apptRuleBlocked) ? 'pointer' : 'default', opacity: (when && !apptRuleBlocked) ? 1 : 0.4 }}>
            {saving ? t('common:saving') : submitLabel}
          </button>
        </div>
      </div>
    </>
  )
}
