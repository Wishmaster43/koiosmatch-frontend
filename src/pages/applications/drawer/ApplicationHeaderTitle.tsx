/**
 * ApplicationHeaderTitle — the application drawer's title block (view + edit),
 * mirroring CandidateHeaderBits' CandidateTitle. Read mode shows the candidate
 * name + reference chip, the candidate's function, and the vacancy this
 * application is for; edit mode swaps in the name-part + function inputs.
 * Pure rendering — all state/mutations come in via props (§3A: dumb component).
 */
import { useTranslation } from 'react-i18next'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import type { ApplicationCandidateForm } from '../hooks/useApplicationCandidateEdit'

const inputBase = { width: '100%', minWidth: 0, boxSizing: 'border-box' as const, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }

interface ApplicationHeaderTitleProps {
  candidateName: string
  referenceNumber: string
  candidateFunction: string
  vacancyTitle: string
  editing: boolean
  loading: boolean
  form: ApplicationCandidateForm
  setField: (k: keyof ApplicationCandidateForm, v: string) => void
}

export default function ApplicationHeaderTitle({
  candidateName, referenceNumber, candidateFunction, vacancyTitle, editing, loading, form, setField,
}: ApplicationHeaderTitleProps) {
  const { t } = useTranslation('applications')

  // Edit mode: voornaam / tussenvoegsel / achternaam on one row, function below —
  // disabled while the candidate's separate name parts are still loading.
  if (editing) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        <input aria-label={t('drawer.firstName')} placeholder={t('drawer.firstName')} value={form.firstName}
          disabled={loading} onChange={e => setField('firstName', e.target.value)}
          style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
        <input aria-label={t('drawer.middleName')} placeholder={t('drawer.middleName')} value={form.middleName}
          disabled={loading} onChange={e => setField('middleName', e.target.value)}
          style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
        <input aria-label={t('drawer.lastName')} placeholder={t('drawer.lastName')} value={form.lastName}
          disabled={loading} onChange={e => setField('lastName', e.target.value)}
          style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
      </div>
      <input aria-label={t('drawer.functionTitle')} placeholder={t('drawer.functionTitle')} value={form.functionTitle}
        disabled={loading} onChange={e => setField('functionTitle', e.target.value)}
        style={{ ...inputBase, fontSize: 12, color: 'var(--text-muted)' }} />
    </div>
  )

  // Read mode: name + reference chip, function (italic placeholder when empty),
  // and — only when present — the vacancy this application is for.
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{candidateName}</span>
        <ReferenceNumberChip value={referenceNumber} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {candidateFunction || <span style={{ fontStyle: 'italic' }}>{t('drawer.noFunction')}</span>}
      </div>
      {vacancyTitle && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.forVacancy')}: {vacancyTitle}</div>
      )}
    </>
  )
}
