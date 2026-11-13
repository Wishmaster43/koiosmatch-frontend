/**
 * OwnerPhaseRow — the owner picker, paired with the start-stage picker when the
 * tenant lookup gave real stages; moved verbatim out of PageAddApplicationModal
 * (SIZE-TRIGGER-1). Presentational: values and setters come from the parent.
 */
import { useTranslation } from 'react-i18next'
import { requiredMark } from '@/components/forms/fields'
import { PickField } from './PickField'

interface Opt { value: string; label: string }

export default function OwnerPhaseRow({ ownerOptions, ownerId, setOwnerId, ownerRequired, stageOptions, phaseId,
  setPhaseIdManual, phaseRequired, errors }: {
  ownerOptions: Opt[]
  ownerId: string
  setOwnerId: (v: string) => void
  ownerRequired: boolean
  stageOptions: { id: string; label: string }[]
  phaseId: string
  setPhaseIdManual: (v: string) => void
  phaseRequired: boolean
  errors: Record<string, boolean>
}) {
  const { t } = useTranslation('applications')
  // Declared once — it renders either on its own row or paired with the phase picker.
  // CLEAR-SWEEP (Danny 13-08): owner is optional (submitted as `owner_id: ownerId ||
  // null` above) — once auto-seeded or manually picked, it must be releasable back
  // to "let the server decide" rather than stuck on whatever was last chosen.
  const ownerField = (
    <div>
      <PickField label={<>{t('add.owner')}{ownerRequired && requiredMark}</>} placeholder={t('add.ownerPlaceholder')}
        clearable={!ownerRequired} clearLabel={t('add.owner')}
        options={ownerOptions} value={ownerId} onChange={setOwnerId} ariaRequired={ownerRequired}
        style={errors.ownerId ? { borderColor: 'var(--color-danger)' } : undefined} />
      {errors.ownerId && !ownerId && ownerRequired && (
        <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
          {t('common:errors.fieldRequired', { field: t('add.owner') })}
        </div>
      )}
    </div>
  )

  // Owner + start stage share a row (§3A: pair short fields into two columns).
  // The phase picker only exists when the tenant lookup gave us real, submittable
  // stages — otherwise owner keeps the full width and the server picks the stage.
  return stageOptions.length > 0 ? (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
    {ownerField}
    {/* CLEAR-SWEEP (Danny 13-08): start stage is optional too — omitted from
        the POST body entirely when empty (see `create` above), so the server's
        own default-stage fallback decides. Must be releasable, not sticky. */}
    <div>
      <PickField label={<>{t('add.phase')}{phaseRequired && requiredMark}</>} placeholder={t('add.phasePlaceholder')}
        clearable={!phaseRequired} clearLabel={t('add.phase')}
        options={stageOptions.map(s => ({ value: s.id, label: s.label }))}
        value={phaseId} onChange={setPhaseIdManual} ariaRequired={phaseRequired}
        style={errors.phase ? { borderColor: 'var(--color-danger)' } : undefined} />
      {errors.phase && !phaseId && phaseRequired && (
        <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
          {t('common:errors.fieldRequired', { field: t('add.phase') })}
        </div>
      )}
    </div>
  </div>
) : ownerField
}
