/**
 * useApplicationStages — the candidate application funnel stages (Settings →
 * Sollicitatie-fases), fetched with their real `id` (needed to submit
 * `application_stage_id` on POST /applications — APP-CREATE-STAGE-1). The shared
 * LookupsContext also exposes these stages as `funnelTypes`, but that shape drops
 * the row `id` (it only needs the stable `value`/key elsewhere); this hook reads
 * the domain `/application-stages` endpoint directly so the real id survives.
 * `is_default` (LOOKUP-DEFAULT-1) marks the tenant's chosen start stage — the
 * "+ Solliciteren" modal preselects it, falling back to the first stage.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (mirrors useAppointmentTypes/useGenders).
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { unwrapList } from '@/lib/api'

export interface ApplicationStageOption {
  id: string
  value: string
  label: string
  color?: string
  is_default: boolean
}

// Seed defaults — mirror LookupsContext's DEFAULT_FUNNEL_TYPES; ids fall back to the
// slug (only meaningful once the real API responds — the seed never actually submits).
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
const DEFAULT_APPLICATION_STAGES: ApplicationStageOption[] = [
  { id: 'applied',  value: 'applied',  label: 'Gesolliciteerd',     color: '#94A3B8', is_default: true },
  { id: 'invited',  value: 'invited',  label: 'Uitgenodigd/Intake', color: '#8C86D9', is_default: false },
  { id: 'proposal', value: 'proposal', label: 'Voorgesteld',        color: '#6FA8C4', is_default: false },
  { id: 'hired',    value: 'hired',    label: 'Aangenomen',         color: '#79B58E', is_default: false },
  { id: 'rejected', value: 'rejected', label: 'Afgewezen',          color: '#D98A8A', is_default: false },
]
/* eslint-enable no-restricted-syntax */

// Normalise a raw /application-stages row — the model appends label(=name)/value(=key)
// on top of the real columns, so both are present; read the appended pair defensively.
const toStage = (r: Record<string, unknown>): ApplicationStageOption => ({
  id: String(r.id ?? ''),
  value: String(r.value ?? r.key ?? ''),
  label: String(r.label ?? r.name ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
  is_default: Boolean(r.is_default),
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapStages = (res: AxiosResponse): ApplicationStageOption[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toStage) : null
}

export function useApplicationStages() {
  const { data: stages } = useCachedLookup('/application-stages', mapStages, DEFAULT_APPLICATION_STAGES)

  // The tenant's flagged start stage (APP-CREATE-STAGE-1), falling back to the first.
  const defaultStage = stages.find(s => s.is_default) ?? stages[0]

  return { stages, defaultStage }
}
