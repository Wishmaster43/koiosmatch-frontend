/**
 * useMatchApprovalMode — reads the tenant's match approval SETTING
 * (goedkeuring-badge-eerlijk, 08-08) via GET /settings/matching
 * (MatchingSettingsController@show — open to any tenant user, no
 * settings.update permission needed to just read it). Lets
 * MatchApprovalBadge tell whether an "Approved" badge carries real
 * information: 'off' means every match auto-approves, so a bare "Approved"
 * is noise; 'on_deviation'/'always' mean the status is a genuine outcome.
 * This is the SAME tenant-wide `/settings/matching` row VacancyMatchingSettings
 * and MatchRatesSettings already read (each with its own inline effect+axios
 * call, out of scope to refactor here) — React Query caches/dedupes this GET
 * app-wide instead of adding a fourth ad-hoc fetch.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

// Backend enum (MatchingSettings::APPROVAL_MODES) — never hardcode elsewhere.
export type ApprovalMode = 'off' | 'on_deviation' | 'always'
// Legacy Dutch wire values (pre ab661e0d) normalise to the English enum, so a
// cached old response can never break the comparisons downstream.
const LEGACY: Record<string, ApprovalMode> = { uit: 'off', bij_afwijking: 'on_deviation', altijd: 'always' }

// The endpoint's OpenAPI entry only documents the 401 response (§10 — no 2xx
// schema yet), so the success shape is hand-written here; only approval_mode
// is needed by this hook.
interface MatchingSettingsResponse { approval_mode?: string }

// Shares the ['settings', 'matching'] query cache with the other Matching-
// settings readers and extracts just approval_mode from the unwrapped body.
export function useMatchApprovalMode(): { approvalMode?: ApprovalMode } {
  const { data } = useQuery({
    queryKey: ['settings', 'matching'],
    queryFn: async ({ signal }) => {
      const body = unwrap<MatchingSettingsResponse>(await api.get('/settings/matching', { signal }))
      return body?.approval_mode
    },
  })
  // undefined while loading/erroring — the badge treats that as "unknown" and
  // falls back to gating on the match's own status alone (never fabricate a mode).
  // Normalise here (not in queryFn) so a cached legacy value is covered too.
  return { approvalMode: data ? (LEGACY[data] ?? (data as ApprovalMode)) : undefined }
}
