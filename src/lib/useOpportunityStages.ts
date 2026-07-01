/**
 * useOpportunityStages — the tenant-configurable opportunity (Kans) pipeline stages.
 *
 * Fed by the API (GET /opportunity-stages) with the seed below as fallback while the
 * list is empty/loading. Managed in Settings → Kansen. Each item carries the stable
 * `value` slug the rows key off, plus the editable label/colour and (from the API)
 * the `id` used when writing `opportunity_stage_id`. Mirrors useFunctions/useGenders.
 */
import { useState, useEffect } from 'react'
import api from './api'
import { normalizeOptions } from './lookupUtils'
import type { LookupOption } from '@/types/common'

// Seed shipped for new tenants + fallback before the backend responds (worklist C-28).
export const DEFAULT_OPPORTUNITY_STAGES: LookupOption[] = [
  { value: 'lead',        label: 'Lead',           color: '#94A3B8' },
  { value: 'qualified',   label: 'Gekwalificeerd', color: '#6FA8C4' },
  { value: 'proposal',    label: 'Voorstel',       color: '#6E8FD6' },
  { value: 'negotiation', label: 'Onderhandeling', color: '#DDA071' },
  { value: 'won',         label: 'Gewonnen',       color: '#79B58E', isWon: true },
  { value: 'lost',        label: 'Verloren',       color: '#D98A8A', isLost: true },
]

export function useOpportunityStages() {
  const [stages, setStages] = useState<LookupOption[]>(DEFAULT_OPPORTUNITY_STAGES)

  // Replace the seed with the tenant lookup once the API responds (404/empty keeps seed).
  useEffect(() => {
    api.get('/opportunity-stages')
      .then(r => { const list = normalizeOptions(r.data?.data ?? r.data); if (list) setStages(list) })
      .catch(() => {})
  }, [])

  // value(slug) → item, with a neutral fallback so the UI never crashes.
  const stageMeta = (v?: string | null): LookupOption => stages.find(s => s.value === v) ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF' }
  return { stages, stageMeta }
}
