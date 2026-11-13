/**
 * CandidateVacancyRow — the candidate | vacancy picker pair (with "+ New candidate"
 * and the locked-vacancy read-only face), moved verbatim out of
 * PageAddApplicationModal (SIZE-TRIGGER-1). Presentational: picks and searches
 * are owned by the parent.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { BodyText } from '@/components/ui/typography'
import { requiredMark } from '@/components/forms/fields'
import type { Id } from '@/types/common'
import SearchPickField from './SearchPickField'
import { ApplicationFieldRow } from './ApplicationFieldRow'
import type { useSearchOptions } from './useSearchOptions'
import type { PickOption } from './types'

type Search = ReturnType<typeof useSearchOptions>

export default function CandidateVacancyRow({ lockedVacancy, pickedCandidate, pickCandidate, candidateSearch,
  pickedVacancy, pickVacancy, vacancySearch, vacancyRequired, vacancyId, errors, onNewCandidate }: {
  lockedVacancy?: { id: Id; title: string; client?: string }
  pickedCandidate: PickOption | null
  pickCandidate: (opt: PickOption) => void
  candidateSearch: Search
  pickedVacancy: PickOption | null
  pickVacancy: (opt: PickOption) => void
  vacancySearch: Search
  vacancyRequired: boolean
  vacancyId: string
  errors: Record<string, boolean>
  onNewCandidate: () => void
}) {
  const { t } = useTranslation('applications')
  const lockedVacancyFieldId = useId()
  return (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
    <div>
      {/* REQUIRED-A11Y-4: the candidate is ALWAYS required (useCreateApplication's
          `create` bails out on !candidateId before anything else runs). */}
      <SearchPickField label={t('add.candidate')} placeholder={t('add.candidatePlaceholder')}
        value={pickedCandidate} options={candidateSearch.options} onPick={pickCandidate}
        onSearch={candidateSearch.setQuery} error={errors.candidateId}
        searchError={candidateSearch.error} onRetry={candidateSearch.retry} ariaRequired />
      {/* NEWCAND-1: a real button (§3A), never coloured text-as-link — opens the
          house AddCandidateModal (with its own CV-parse entry points) on top. */}
      <Button variant="secondary" size="sm" style={{ marginTop: 6 }} onClick={onNewCandidate}>
        <UserPlus size={12} /> {t('add.newCandidate')}
      </Button>
    </div>
    {lockedVacancy ? (
      // CLONE-BY-CONSTRUCTION-1: the shared field-row shell, read-only content.
      // spacing="none": this cell sits in the candidate|vacancy grid (16px gap owns
      // the vertical rhythm) — the row shell's own margin would double up.
      <ApplicationFieldRow fieldId={lockedVacancyFieldId} label={t('add.vacancy')} spacing="none">
        <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <BodyText as="span">
            {lockedVacancy.client ? `${lockedVacancy.title} · ${lockedVacancy.client}` : lockedVacancy.title}
          </BodyText>
        </div>
      </ApplicationFieldRow>
    ) : (
      // VACATURE-OPTIONEEL: labelled optional so the field's own placement never
      // reads as a required step — an open application (no vacancy yet) is real.
      // APP-REQUIRED-FE-1: once the tenant requires it, the honest "(optioneel)"
      // hint is replaced by the same red-asterisk marker every other field uses.
      <div>
        <SearchPickField
          label={vacancyRequired
            ? <>{t('add.vacancy')}{requiredMark}</>
            : <><span>{t('add.vacancy')}</span> <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('add.vacancyOptional')}</span></>}
          placeholder={t('add.vacancyPlaceholder')}
          value={pickedVacancy} options={vacancySearch.options} onPick={pickVacancy}
          onSearch={vacancySearch.setQuery} error={errors.vacancyId}
          searchError={vacancySearch.error} onRetry={vacancySearch.retry} ariaRequired={vacancyRequired} />
        {errors.vacancyId && !vacancyId && vacancyRequired && (
          <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>
            {t('common:errors.fieldRequired', { field: t('add.vacancy') })}
          </div>
        )}
      </div>
    )}
  </div>
  )
}
