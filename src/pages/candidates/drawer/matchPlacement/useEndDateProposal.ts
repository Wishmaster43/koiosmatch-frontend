/**
 * useEndDateProposal — proposes the placement's end date from the picked
 * contract type's default duration (7.1, MATCH-CONTRACT-DURATION-1). Honest-
 * gated: `options` carries `default_duration_days: null` for every row until the
 * backend column ships (useContractTypes), so this simply stays a no-op — never
 * a crash, never a fabricated default. Mirrors useCascadeDefaults' propose-but-
 * freeze-on-edit pattern: recomputes whenever the contract type or start date
 * changes, UNLESS the recruiter has already edited the end date by hand
 * (`endDateDirty`), which freezes it for good.
 */
import { useState, useEffect } from 'react'
import { addDays } from './helpers'
import type { ContractTypeOption } from '@/lib/useContractTypes'

export function useEndDateProposal({ contractType, startDate, options = [] }: {
  contractType: string; startDate: string; options?: ContractTypeOption[]
}) {
  const [endDate, setEndDate] = useState('')
  const [endDateDirty, setEndDateDirty] = useState(false)

  useEffect(() => {
    if (endDateDirty || !contractType || !startDate) return
    const days = options.find(o => o.value === contractType || o.label === contractType)?.default_duration_days
    if (days == null) return // no BE duration yet (or type carries none) — honest no-op
    setEndDate(addDays(startDate, days))
  }, [contractType, startDate, options, endDateDirty])

  return { endDate, setEndDate, setEndDateDirty }
}
