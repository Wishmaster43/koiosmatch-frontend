/**
 * planIntake/usePlanIntakeForm — everything the appointment modal does that is
 * NOT markup: the lookup wiring, the prefill/default state, the four
 * resync/auto-default effects (type · appointment-location · recruiter · vacancy
 * title), the AXIS-MATRIX-2 preflight, the "where" pick logic (tenant lookup vs.
 * a real branch) and the create/edit submit with its 422 field mapping. Split
 * out of PlanIntakeModal.tsx (406 lines) so that file is a thin container that
 * only renders — the same shape as the sibling match/
 * useMatchForm. Hooks are called in the exact order the component used
 * to call them itself, so behaviour is unchanged.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
import type { Modality } from '@/lib/useAppointmentTypes'
import { useAppointmentLocations } from '@/lib/useAppointmentLocations'
import { useLocations } from '@/lib/useLocations'
import { useVacancyOptions } from '../../hooks/useVacancyOptions'
import { useActionRulePreflight } from '@/components/actionrules'
import { API_TO_FORM, defaultWhen, endTimeOf, userName } from './helpers'
import type { UserLike } from './helpers'
import type { Id } from '@/types/common'

export interface ExistingAppointment {
  id: Id; scheduled_at?: string; duration_min?: number | null; modality?: string; owner_id?: Id
  type?: string; vacancy_id?: Id | null; location_id?: Id | null; appointment_location?: string | null
}

export interface PlanIntakeFormOptions {
  candidateId: Id
  onClose: () => void
  onCreated: () => void
  // When present the modal EDITS this appointment (prefill + PATCH) instead of creating.
  existing?: ExistingAppointment
  // Links a newly-created appointment to this application (create only — an edit keeps its original link).
  applicationId?: Id | null
  // Prefills the vacancy select when there is no existing appointment (booking from a vacancy/application).
  defaultVacancyId?: Id | null
  // RECRUITER-DEFAULT-1 (Danny 05-08): the candidate's own owner, passed down from the
  // already-loaded drawer record (WorkTab's `c.ownerId`) — the highest-priority
  // recruiter default below; mirrors AddApplicationModal's candidateOwnerId (never refetched).
  candidateOwnerId?: Id | null
  // Generic copy ("Afspraak…") for non-candidate-drawer callers; default keeps the original intake wording.
  mode?: 'intake' | 'appointment'
}

// A real tenant location (vs. a lookup entry) is encoded with this prefix inside the ONE "where" select.
const LOC_PREFIX = 'loc:'

export function usePlanIntakeForm({
  candidateId, onClose, onCreated, existing, applicationId = null, defaultVacancyId = null,
  candidateOwnerId = null, mode = 'intake',
}: PlanIntakeFormOptions) {
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
  // (intake-only vs. all types), falling back to the first option. When planning
  // FROM an application (applicationId present), the second singleton
  // `is_default_for_application` wins over the plain default (APPT-1, 04-08).
  const defaultTypeOption = (applicationId ? typeOptions.find(x => x.is_default_for_application) : undefined)
    ?? typeOptions.find(x => x.is_default) ?? typeOptions[0]

  // datetime-local wants "YYYY-MM-DDTHH:MM" — trim an ISO string to that shape.
  const toLocalInput = (iso?: string) => iso ? iso.slice(0, 16) : ''
  const [type, setType] = useState(() => existing?.type ?? defaultTypeOption?.value ?? '')
  const [when, setWhen] = useState(() => existing?.scheduled_at ? toLocalInput(existing.scheduled_at) : defaultWhen())
  // Duration + modality prefill from the existing appointment, else from the SAME
  // chosen default type (BUG FIX: this used to read `typeOptions[0]` — the FIRST
  // option in the list — while `type` itself read `defaultTypeOption`; for any
  // tenant whose default type isn't first, the modal opened showing the right
  // type next to another type's duration/modality. Both must come from one option.
  const [duration, setDuration] = useState<number>(() => existing?.duration_min ?? defaultTypeOption?.default_duration_min ?? 30)
  const [modality, setModality] = useState<Modality>(() => (existing?.modality as Modality) ?? defaultTypeOption?.default_modality ?? 'office')
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
    // AbortController (§9) — a fast vacancy-id switch must never let a stale
    // response win; mirrors VacancySearchTab's own vacancy-title fetch.
    const ctrl = new AbortController()
    api.get(`/vacancies/${vacancyId}`, { signal: ctrl.signal, quiet404: true })
      .then(r => {
        const d = unwrap<{ title?: string }>(r)
        setExtraVacancy({ value: String(vacancyId), label: d?.title ? String(d.title) : t('work.vacancyUnknown') })
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setExtraVacancy({ value: String(vacancyId), label: t('work.vacancyUnknown') }) })
    return () => ctrl.abort()
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

  // AXIS-MATRIX-2 preflight (mirrors MatchModal's match.create wiring, the
  // reference implementation): POST /candidates/{id}/appointments enforces
  // appointment.create against the candidate server-side (AppointmentController::
  // store) — surface the same warn/block decision here BEFORE submit. Only relevant
  // on CREATE: the PATCH edit path (AppointmentController::update) never re-runs the
  // guard, so an edit of an already-scheduled appointment is never gated by it.
  const { decision: apptRuleDecisionRaw } = useActionRulePreflight('appointment.create', { candidateId: String(candidateId || '') })
  const apptRuleDecision = editing ? null : apptRuleDecisionRaw
  const apptRuleBlocked = apptRuleDecision?.effect === 'block'

  // RECRUITER-DEFAULT-1 (Danny 05-08: "+ intake recruiter komt er niet standaard te
  // staan" — measured live: the OLD effect only ever tried the logged-in-user
  // fallback below; the modal never received the candidate's own owner at all, so
  // the docblock's "defaults to the logged-in user" claim silently skipped the
  // higher-priority pick whenever the recruiter opening the modal wasn't the
  // candidate's own owner). Derivation chain, CREATE only: the candidate's own
  // owner wins when they are a real assignable tenant user (no extra fetch — reuses
  // this same /users lookup); otherwise the logged-in user, same meIsAssignable
  // guard as before (never proposes a non-tenant login, e.g. a super-admin, the
  // server would 422 on); otherwise the field stays empty for the recruiter to pick.
  const ownerOptions = users.map(u => ({ value: String(u.id), label: userName(u) }))
  const meIsAssignable = me?.id != null && ownerOptions.some(o => o.value === String(me.id))
  const candidateOwnerAssignable = candidateOwnerId != null && ownerOptions.some(o => o.value === String(candidateOwnerId))
  // Seeded ONCE: `ownerId` itself is the seeded-once guard (nothing in this form can
  // ever reset a picked owner back to '', so this never re-fires after a manual pick
  // or an earlier auto-seed) — mirrors useVacancySearch's userTouched flag, needed
  // there instead because that value CAN revert to empty on its own. `candidateOwnerId`
  // and `me` are read at the moment their own resolved flags (below) turn true, in the
  // SAME render — deliberately left out of the deps array for that reason.
  useEffect(() => {
    if (editing || ownerId) return
    if (candidateOwnerAssignable) { setOwnerId(String(candidateOwnerId)); return }
    if (meIsAssignable) setOwnerId(String(me!.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above the effect
  }, [editing, ownerId, candidateOwnerAssignable, meIsAssignable])

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
  // BUG FIX: this used to fall back to the hardcoded slug 'intake' — not a real
  // tenant vocabulary entry (types are tenant-configurable, §3B) and never
  // guaranteed to exist. `type` is kept in sync with the resolved default by the
  // resync effect above, so by the time submit runs it normally already holds a
  // real option; the only way it stays empty is a tenant with zero configured
  // (intake) appointment types — refuse to submit rather than guess a slug that
  // may not exist server-side (mirrors the `!when` guard just below, and the
  // submit button's own disabled state in PlanIntakeModal.tsx).
  const submit = async () => {
    if (!when || !type) return
    setSaving(true)
    setErrors({}); setSubmitErr(null)
    const body = {
      scheduled_at: when, type, duration_min: duration, modality,
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

  // Generic ("Afspraak…") vs the original intake-specific header/button/hint copy —
  // resolved here so the markup never has to branch on `mode` itself.
  const heading = editing
    ? t(mode === 'appointment' ? 'work.editAppointment' : 'work.editIntake')
    : t(mode === 'appointment' ? 'work.planAppointment' : 'work.planIntake')
  const submitLabel = editing ? t('common:save') : t(mode === 'appointment' ? 'work.createAppointment' : 'work.createIntake')
  const vacancyHint = t(mode === 'appointment' ? 'work.appointmentVacancyHint' : 'work.intakeVacancyHint')

  return {
    t, editing, heading, submitLabel, vacancyHint,
    typeOptions, type, pickType,
    when, setWhen, duration, setDuration, endTime,
    whereValue, whereOptions, pickWhere,
    ownerId, setOwnerId, ownerOptions,
    vacancyId, setVacancyId, vacancyOptions, vacancyFallback,
    apptRuleDecision, apptRuleBlocked,
    saving, errors, submitErr, submit,
  }
}
