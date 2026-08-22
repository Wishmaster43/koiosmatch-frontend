/**
 * ApplicationHeaderTitle — the application drawer's title block (view + edit),
 * mirroring CandidateHeaderBits' CandidateTitle. Read mode shows the candidate
 * name + reference chip, the candidate's function, and the vacancy this
 * application is for; edit mode swaps in the name-part + function inputs.
 * Pure rendering — all state/mutations come in via props (§3A: dumb component).
 */
import { useTranslation } from 'react-i18next'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
// HUISSTIJL-1: name inputs carry the sectionTitle identity via its raw style
// export (an <input> cannot BE a text atom — stijlfabriek route, §4 r6);
// the read-mode name renders through the PageTitle atom itself.
import { PageTitle, sectionTitleStyle } from '@/components/ui/typography'
import type { ApplicationCandidateForm } from '../hooks/useApplicationCandidateEdit'

// Canon field style (G33/fieldMetrics) — mirrors CandidateHeaderBits' inputBase;
// `minWidth: 0` stays local since it only matters inside this header's grid.
const inputBase = { ...fieldInputStyle, minWidth: 0 }

interface ApplicationHeaderTitleProps {
  candidateName: string
  referenceNumber: string
  candidateFunction: string
  editing: boolean
  loading: boolean
  form: ApplicationCandidateForm
  setField: (k: keyof ApplicationCandidateForm, v: string) => void
}

export default function ApplicationHeaderTitle({
  candidateName, referenceNumber, candidateFunction, editing, loading, form, setField,
}: ApplicationHeaderTitleProps) {
  const { t } = useTranslation('applications')

  // Edit mode: voornaam / tussenvoegsel / achternaam on one row, function below —
  // disabled while the candidate's separate name parts are still loading.
  if (editing) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {/* Danny 22-08: tussenvoegsel is the SHORT part — weighted narrower so
          first/last name get the room; the propose action hides while editing
          (ApplicationDrawer), so this grid finally has the full header width. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(96px, 0.7fr) minmax(0, 1.6fr)', gap: 6 }}>
        <input aria-label={t('drawer.firstName')} placeholder={t('drawer.firstName')} value={form.firstName}
          disabled={loading} onChange={e => setField('firstName', e.target.value)}
          style={{ ...inputBase, fontSize: sectionTitleStyle.fontSize, fontWeight: sectionTitleStyle.fontWeight }} />
        <input aria-label={t('drawer.middleName')} placeholder={t('drawer.middleName')} value={form.middleName}
          disabled={loading} onChange={e => setField('middleName', e.target.value)}
          style={{ ...inputBase, fontSize: sectionTitleStyle.fontSize, fontWeight: sectionTitleStyle.fontWeight }} />
        <input aria-label={t('drawer.lastName')} placeholder={t('drawer.lastName')} value={form.lastName}
          disabled={loading} onChange={e => setField('lastName', e.target.value)}
          style={{ ...inputBase, fontSize: sectionTitleStyle.fontSize, fontWeight: sectionTitleStyle.fontWeight }} />
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
        <PageTitle as="span">{candidateName}</PageTitle>
        <ReferenceNumberChip value={referenceNumber} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {candidateFunction || <span style={{ fontStyle: 'italic' }}>{t('drawer.noFunction')}</span>}
      </div>
    </>
  )
}
