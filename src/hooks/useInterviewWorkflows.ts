/**
 * useInterviewWorkflows — the tenant's PICKABLE interview workflows
 * (INTERVIEW-WORKFLOW-1, Appendix D/E), shared by the vacancy's own workflow
 * link (VacancyAgentTab) and the application-level override (InterviewStatusCard).
 * Mirrors useAiAgents/useInterviewFlows' shape/caching so every picker behaves
 * identically (§3A consistency).
 *
 * `GET /workflows?kind=interview` is the primary contract; a tenant/backend that
 * does not yet honour the `kind` query param still returns its full workflow
 * list, so a client-side filter on `kind`/`tag` (when either is present) is the
 * fallback — never a second endpoint, never a silent "show everything".
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Workflow } from '@/types/workflow'
import type { Id } from '@/types/common'

// One pickable option, grouped by its folder name (Kelly -> Kelly-Helpende) so
// the select label states provenance at a glance — there is no two-level select
// atom in the shared component library yet (§3A: no reuse target found), so the
// grouping is flattened into the label text itself.
export interface InterviewWorkflowOption { value: string; label: string }

const NO_WORKFLOWS: Workflow[] = []

// True when the workflow is explicitly tagged as an interview workflow — used
// only for the client-side fallback filter (the `kind=interview` query param is
// the real gate, applied server-side).
const isInterviewKind = (w: Workflow): boolean => w.kind === 'interview' || w.tag === 'interview'

// The tenant's interview-workflow picker options + a byId lookup, one cached
// react-query entry shared across every consumer.
export function useInterviewWorkflows(enabled: boolean = true) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['interview-workflows'],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<Workflow>(await api.get('/workflows', { params: { kind: 'interview' }, signal }))
      // Fallback filter: only engages when the payload actually carries a
      // kind/tag field AND none of the rows match — a backend that already
      // honours ?kind=interview server-side returns an all-matching list, so
      // this never double-filters a correct response.
      const anyTagged = rows.some(w => w.kind != null || w.tag != null)
      return anyTagged && !rows.every(isInterviewKind) ? rows.filter(isInterviewKind) : rows
    },
  })
  const workflows = data ?? NO_WORKFLOWS

  // ACTIVE workflows only for a NEW pick (mirrors useInterviewFlows' own rule,
  // r2 C1): an inactive workflow offered here would let a recruiter silently
  // switch a linked interview off. `describe()` below still resolves an
  // inactive one that was linked BEFORE it went inactive, so the picker can
  // show the truth instead of an unexplained blank.
  const active = useMemo(() => workflows.filter(w => w.status !== 'inactive'), [workflows])
  // Folder name prefixes the workflow's own name ("Kelly · Kelly-Helpende") —
  // the TITELBALK-PILLS-style compact label, since no grouped-select atom exists.
  const options: InterviewWorkflowOption[] = useMemo(
    () => active.map(w => ({
      value: String(w.id ?? ''),
      label: w.folder?.name ? `${w.folder.name} · ${w.name ?? ''}` : (w.name ?? ''),
    })),
    [active],
  )
  const byId = useMemo(() => new Map(workflows.map(w => [String(w.id), w])), [workflows])
  // For a value bound BEFORE its workflow went inactive (or that never made it
  // into `options` because of the active filter): resolve its label + state so
  // the picker can render the truth instead of a raw id or an unexplained gap
  // (mirrors useInterviewFlows.describe).
  const describe = (id?: Id | null) => {
    if (id == null || id === '') return null
    const w = byId.get(String(id))
    if (!w) return null
    return { label: w.folder?.name ? `${w.folder.name} · ${w.name ?? ''}` : (w.name ?? ''), inactive: w.status === 'inactive' }
  }

  return { options, workflows, byId, describe, loading: isLoading, error: isError }
}
