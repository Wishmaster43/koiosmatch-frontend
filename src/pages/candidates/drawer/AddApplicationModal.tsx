/**
 * AddApplicationModal — "+ Solliciteren" from the candidate Match tab: couple the
 * candidate to a vacancy in a chosen funnel phase. vacancy_id is REQUIRED by the
 * backend (a vacancy-less application is created via the intake flow instead), so
 * the save button stays disabled until a vacancy is picked. On success the host
 * reloads the applications list.
 *
 * S24b (Danny 16-07): vacancy + phase are both searchable pickers (CreatableSelect,
 * allowCreate=false — a vacancy/stage is a real relational id, never free text); the
 * phase picker now actually WORKS server-side — POST /applications previously only
 * accepted `phase_key`, which the backend silently ignored on create (APP-CREATE-
 * STAGE-1 fixed this), so this now sends the real `application_stage_id` and
 * preselects the tenant's flagged default stage (falling back to the first stage).
 *
 * AXIS-MATRIX-2 (CMFE audit R1): wires the shared action-rule preflight for
 * `application.create` (mirrors MatchPlacementModal's match.create) — a warn cell
 * shows an inline banner and still lets the recruiter proceed; a block cell (e.g. an
 * archived/blacklisted candidate) additionally disables Create, matching what the
 * backend's own ApplicationController::store guard will refuse anyway.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useVacancyOptions } from '../hooks/useVacancyOptions'
import { useApplicationStages } from '../hooks/useApplicationStages'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useActionRulePreflight, ActionRuleBanner } from '@/components/actionrules'
import type { Id } from '@/types/common'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }
const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
// Consistent searchable-menu width (mirrors PlanIntakeModal/MatchPlacementModal's vacancy picker).
const pickerMenuWidth = 340

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = { candidate_id: 'candidateId', vacancy_id: 'vacancyId', application_stage_id: 'phase' }

export default function AddApplicationModal({ candidateId, onClose, onCreated }: {
  candidateId: Id
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation('candidates')
  const vacancyOptions = useVacancyOptions(true)
  // S24b: the real stage id (not just the slug) — needed to submit application_stage_id.
  const { stages, defaultStage } = useApplicationStages()

  // AXIS-MATRIX-2 preflight (mirrors MatchPlacementModal's match.create wiring, the
  // reference implementation): POST /applications enforces application.create against
  // the candidate server-side (ApplicationController::store) — surface the same
  // warn/block decision here BEFORE submit. warn stays a banner only (proceed
  // allowed); block additionally disables the submit button (§3A "calm explanation",
  // never a silent 422 the recruiter has to decode).
  const { decision: appRuleDecision } = useActionRulePreflight('application.create', { candidateId: String(candidateId || '') })
  const appRuleBlocked = appRuleDecision?.effect === 'block'

  const [vacancyId, setVacancyId] = useState('')
  // Default to the tenant's flagged start stage (APP-CREATE-STAGE-1), falling back to the first.
  const [phaseId, setPhaseId] = useState(() => defaultStage?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  // Measured live (PlanIntakeModal probe hit the identical bug — see its S24a(c)
  // comment): the lazy useState initializer above only reads `stages` at MOUNT time,
  // which is still the seed fallback (useCachedLookup's real /application-stages
  // fetch resolves a beat later). The seed's fake id ("applied") never matches a REAL
  // stage's UUID, so once the real data replaces the seed, `phaseId` is left holding
  // a value that matches nothing — the picker then shows its placeholder instead of
  // the default. Re-sync to the CURRENT default whenever it no longer matches a real
  // option; skipped once the recruiter (or an already-valid default) picked one.
  useEffect(() => {
    if (phaseId && stages.some(s => s.id === phaseId)) return
    if (!defaultStage) return
    setPhaseId(defaultStage.id)
  }, [defaultStage, stages, phaseId])

  // Couple to the vacancy via the canonical POST /applications (vacancy_id required).
  const submit = async () => {
    if (!vacancyId) return
    setSaving(true)
    setErrors({})
    try {
      await api.post('/applications', { candidate_id: candidateId, vacancy_id: vacancyId, application_stage_id: phaseId || undefined })
      notifySuccess(t('work.applicationCreated'))
      onCreated(); onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one) instead of a fixed toast string.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      }
      notifyError(e?.response?.data?.message ?? t('work.applicationFailed'))
    } finally { setSaving(false) }
  }

  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('work.addApplication')} tabIndex={-1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('work.addApplication')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* AXIS-MATRIX-2 preflight — warn/block on this candidate before the recruiter picks a vacancy. */}
        {appRuleDecision && appRuleDecision.effect !== 'allow' && (
          <div style={{ marginBottom: 14 }}><ActionRuleBanner decision={appRuleDecision} /></div>
        )}

        {/* Vacancy — searchable pick-only combobox (S24b), mirrors PlanIntakeModal. */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>{t('work.vacancy')}</div>
          <CreatableSelect value={vacancyId || null} onChange={setVacancyId} placeholder={t('work.pickVacancy')}
            allowCreate={false} menuWidth={pickerMenuWidth}
            options={vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))} />
          {errors.vacancyId && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('work.applicationFailed')}</div>}
        </div>
        {/* Fase — searchable pick-only combobox; now submits the real stage id (S24b). */}
        <div style={{ marginBottom: 20 }}>
          <div style={fieldLabel}>{t('work.phase')}</div>
          <CreatableSelect value={phaseId || null} onChange={setPhaseId} allowCreate={false} menuWidth={pickerMenuWidth}
            options={stages.map(s => ({ value: s.id, label: s.label }))} />
          {errors.phase && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('work.applicationFailed')}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={submit} disabled={saving || !vacancyId || appRuleBlocked}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: (vacancyId && !appRuleBlocked) ? 'pointer' : 'default', opacity: (vacancyId && !appRuleBlocked) ? 1 : 0.4 }}>
            {saving ? t('common:saving') : t('work.createApplication')}
          </button>
        </div>
      </div>
    </>
  )
}
