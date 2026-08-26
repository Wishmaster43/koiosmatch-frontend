/**
 * BranchSection — candidate-side adapter onto the shared components/drawer/
 * BranchSection (§3A/§11: promoted so the customer drawer reuses the exact same
 * block instead of a second copy, Danny 28-07 "dit wil ik ook terug zien bij
 * klanten"). Data/mutation logic stays in useCandidateBranches — the candidate's
 * own resource already embeds its branch membership (no GET route), unlike a
 * customer (VESTIGING-2 fase 4's dedicated endpoint, see useEntityBranches) — this
 * file only translates the labels and wires the toggle through.
 */
import { useTranslation } from 'react-i18next'
import SharedBranchSection from '@/components/drawer/BranchSection'
import { useCandidateBranches } from '../hooks/useCandidateDrawerData'
import type { Candidate } from '@/types/candidate'

// Candidate-side adapter onto the shared BranchSection.
export default function BranchSection({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { branches, options, selectedIds, toggle } = useCandidateBranches(c)
  return (
    <SharedBranchSection
      label={t('sections.branch')}
      addLabel={t('sections.branchLink')}
      emptyLabel={t('sections.branchEmpty')}
      options={options}
      selectedIds={selectedIds}
      branches={branches}
      onToggle={toggle}
    />
  )
}
