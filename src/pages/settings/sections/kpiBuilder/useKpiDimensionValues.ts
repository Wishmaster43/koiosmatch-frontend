/**
 * useKpiDimensionValues — the value options for a KPI's `dimension_value` field,
 * one arm per dimension the registry can offer. Unlike the report filter panel's
 * equivalents (contractFormOptions, application-stage sentinel-prefixed lists),
 * the builder form never offers a 'none' bucket — a KPI either fans out over
 * every real value (dimension_value left empty) or targets exactly one of them.
 *
 * `all` carries no value picker at all (`supported: false`) — the form only
 * renders `KpiDimensionValueField` when `dimension !== 'all'` (1.5).
 */
import { useMemo } from 'react'
import { useLookups } from '@/context/LookupsContext'
import { useApplicationStages } from '@/hooks/useApplicationStages'
import { useContractTypes } from '@/lib/useContractTypes'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { mapIdLabelOptions } from '@/lib/idLookupOptions'
import type { KpiEntity } from './kpiDefinitionsApi'

export interface KpiDimensionOption { value: string; label: string }

const EMPTY_OPTIONS: KpiDimensionOption[] = []

// Task-type lookup keyed by its raw id (the drill route's `type[]` param
// validates against the id, same vocabulary as reportStatusLookups.ts'
// useTaskTypeIdOptions). The row→option mapping itself is the shared
// `mapIdLabelOptions` (extracted so this and reportStatusLookups.ts don't hand-
// copy the same mapper) — the FETCH stays separate per file: this hook lives
// under `pages/settings/...`, a different entity folder than `pages/reports/`,
// and importing that file's hook directly would cross the §2 barrel boundary.
// Promote to `src/hooks/` if a third consumer needs the same id-keyed list.
const mapTaskTypeOptions = mapIdLabelOptions

// Returns the value options for one dimension key, plus whether that dimension
// supports a value picker at all. `entity` is accepted for a future dimension
// whose options depend on it (none does today — every current dimension key is
// already entity-specific by name, e.g. `match_contract_form`), so the form can
// call this hook the same way regardless of which dimension is active.
export function useKpiDimensionValues(_entity: KpiEntity, dimension: string) {
  const { candidateTypes, loading: candidateTypesLoading } = useLookups()
  const { stages } = useApplicationStages()
  const { options: contractTypeOptions } = useContractTypes()
  const { data: taskTypeOptions, loading: taskTypesLoading } = useCachedLookup(
    '/task-types',
    mapTaskTypeOptions,
    EMPTY_OPTIONS,
  )

  const applicationStageOptions = useMemo(
    () => stages.map(s => ({ value: s.value, label: s.label })),
    [stages],
  )
  const matchContractFormOptions = useMemo(
    () => candidateTypes.map(c => ({ value: c.value, label: c.label })),
    [candidateTypes],
  )
  // R5 (open, CMBE): `match_contract_type` posts the contract-type SLUG here
  // (mirrors useContractTypes' own value/label split) pending confirmation of
  // the drill route's exact vocabulary for this dimension.
  const matchContractTypeOptions = useMemo(
    () => contractTypeOptions.map(o => ({ value: o.value, label: o.label })),
    [contractTypeOptions],
  )

  switch (dimension) {
    case 'application_stage':
      return { options: applicationStageOptions, loading: false, supported: true }
    case 'match_contract_form':
      return { options: matchContractFormOptions, loading: candidateTypesLoading, supported: true }
    case 'match_contract_type':
      return { options: matchContractTypeOptions, loading: false, supported: true }
    case 'task_type':
      return { options: taskTypeOptions, loading: taskTypesLoading, supported: true }
    default:
      return { options: EMPTY_OPTIONS, loading: false, supported: false }
  }
}
