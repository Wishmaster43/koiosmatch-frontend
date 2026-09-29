// INTERVIEW-VISIBILITY-1 (Danny 29-09: "als de workflow gekozen is, is het losse
// AI-agent-veld niet meer nodig; de agent zit in de workflow"): the OLD flow-
// override picker is gone — the workflow override below is the ONE path, and it
// resolves its own agent+flow. What replaces it: when this application has no
// own workflow, an honest caption says whether the VACANCY carries a default
// (and a button to go set/change it there) or whether neither exists yet.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { useInterviewWorkflows } from '@/hooks/useInterviewWorkflows'
import InterviewWorkflowPicker from '@/components/drawer/InterviewWorkflowPicker'
import { useNavigation } from '@/context/NavigationContext'
import { resolveEffectiveInterviewWorkflow } from '../data/interviewWorkflowEffective'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { InterviewWorkflowRef } from '@/types/vacancy'
import type { Id } from '@/types/common'

// Same own-echo idiom as the session-actions hook: a fresh prop (parent
// refetch) always wins over our own local echo of a just-saved value.
export function useInterviewOverrides({
  applicationId, interviewWorkflowId, interviewWorkflow, hasInterviewWorkflowField, canManage, vacancyId, vacancyInterviewWorkflow,
}: {
  applicationId?: Id; interviewWorkflowId?: Id | null
  interviewWorkflow?: InterviewWorkflowRef | null; hasInterviewWorkflowField: boolean; canManage: boolean
  // INTERVIEW-VISIBILITY-1: the vacancy's own default + its id (for the "edit in
  // vacancy" deep link) — both optional, tolerant of a backend/caller that hasn't
  // wired them yet (no caption/button then, never a broken deep link). `undefined`
  // is a distinct, presence-gated case (§3): the backend simply doesn't report
  // the key yet, vs. `null` meaning it reported "the vacancy has none".
  vacancyId?: Id | null; vacancyInterviewWorkflow?: InterviewWorkflowRef | null | undefined
}) {
  const { t } = useTranslation('applications')
  const { openEntity } = useNavigation()

  // INTERVIEW-WORKFLOW-1: this application's own workflow override — the ONE path.
  const { options: workflowOptions, byId: workflowById, describe: describeWorkflow, loading: workflowsLoading, error: workflowsError, forbidden: workflowsForbidden } = useInterviewWorkflows(hasInterviewWorkflowField)
  const [workflowOverride, setWorkflowOverride] = useState<Id | null | undefined>(undefined)
  const currentWorkflowId = workflowOverride !== undefined ? workflowOverride : interviewWorkflowId ?? null
  const isWorkflowLinked = hasInterviewWorkflowField && currentWorkflowId != null
  const linkedWorkflow = currentWorkflowId != null ? workflowById.get(String(currentWorkflowId)) : undefined
  const derivedWorkflowName = linkedWorkflow?.name ?? interviewWorkflow?.name ?? '—'
  const [workflowSaving, setWorkflowSaving] = useState(false)
  const pickWorkflow = async (id: string) => {
    if (applicationId == null || workflowSaving) return
    const nextId = id || null
    setWorkflowSaving(true)
    try {
      await api.patch(`/applications/${applicationId}`, { interview_workflow_id: nextId })
      setWorkflowOverride(nextId)
      notifySuccess(t('interview.status.workflowOverrideSaved'))
    } catch (err) {
      notifyError(extractApiError(err, t('common:actionFailed')))
    } finally {
      setWorkflowSaving(false)
    }
  }
  useEffect(() => { setWorkflowOverride(undefined) }, [interviewWorkflowId])

  // INTERVIEW-WORKFLOW-1: the override picker — an application-level binding,
  // independent of whether a live session exists, authorization-gated like stop/resume.
  const workflowOverridePicker = canManage && applicationId != null && (
    <InterviewWorkflowPicker
      value={currentWorkflowId}
      onChange={pickWorkflow}
      options={workflowOptions}
      loading={workflowsLoading}
      error={workflowsError}
      disabled={!hasInterviewWorkflowField || workflowsForbidden}
      // INTERVIEW-403-1: the list is a role answer — an inert picker with a calm notice, never a red load error.
      notice={workflowsForbidden ? t('interview.status.pickerForbidden') : hasInterviewWorkflowField ? undefined : t('vacancies:aiagent.workflow.unavailable')}
      linkedRef={interviewWorkflow}
      describe={describeWorkflow}
    />
  )

  // INTERVIEW-VISIBILITY-1: once this application has NO own workflow, say
  // plainly whether the vacancy already carries a default (naming it) or
  // whether neither exists yet — always with a way to go set it on the vacancy,
  // never a second interactive picker here (the vacancy owns that field).
  // `vacancyInterviewWorkflow === undefined` means the backend doesn't report
  // the key at all yet — resolveEffectiveInterviewWorkflow reads it as "none"
  // (null-like), but the caption below still needs the undefined/null
  // distinction so it never CLAIMS "no workflow" when it simply wasn't told.
  const effective = resolveEffectiveInterviewWorkflow(
    isWorkflowLinked ? { id: currentWorkflowId as Id, name: derivedWorkflowName, agent: linkedWorkflow?.agent ?? interviewWorkflow?.agent ?? null } : null,
    vacancyInterviewWorkflow,
  )
  const goToVacancyAgent = () => { if (vacancyId != null) openEntity('vacancies', vacancyId, 'aiagent') }
  // Same gate as workflowOverridePicker above — a read-only render (e.g. the
  // match drawer's AgentSessionsTab, which passes no applicationId at all) gets
  // neither the picker nor this caption, never a half-editable card.
  const vacancyDefaultBlock = canManage && applicationId != null && !isWorkflowLinked && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* Presence-gated: the backend not reporting the vacancy's workflow key at
          all is not the same claim as "the vacancy has none" — say nothing
          rather than lie (only the deep-link button still renders). */}
      {vacancyInterviewWorkflow !== undefined && (
        <Caption style={{ fontStyle: 'italic' }}>
          {effective
            ? t('interview.status.vacancyDefault', { workflow: effective.workflowName, agent: effective.agentName })
            : t('interview.status.noWorkflow')}
        </Caption>
      )}
      {vacancyId != null && (
        <Button variant="ghost" size="sm" onClick={goToVacancyAgent}>{t('interview.status.editInVacancy')}</Button>
      )}
    </div>
  )

  return { workflowOverridePicker, vacancyDefaultBlock, effective }
}
