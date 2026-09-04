// Extracted from InterviewStatusCard (SIZE-SPLIT-B, zero behaviour change): the
// flow-override and workflow-override state machines plus their picker JSX,
// so the card component itself stops carrying two independent PATCH flows.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { Caption, GroupLabel } from '@/components/ui/typography'
import { useInterviewFlows } from '@/hooks/useInterviewFlows'
import { useInterviewWorkflows } from '@/hooks/useInterviewWorkflows'
import InterviewWorkflowPicker from '@/components/drawer/InterviewWorkflowPicker'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { InterviewWorkflowRef } from '@/types/vacancy'
import type { Id } from '@/types/common'

// Same own-echo idiom as the session-actions hook: a fresh prop (parent
// refetch) always wins over our own local echo of a just-saved value.
export function useInterviewOverrides({
  applicationId, interviewFlowId, interviewWorkflowId, interviewWorkflow, hasInterviewWorkflowField, canManage,
}: {
  applicationId?: Id; interviewFlowId?: Id | null; interviewWorkflowId?: Id | null
  interviewWorkflow?: InterviewWorkflowRef | null; hasInterviewWorkflowField: boolean; canManage: boolean
}) {
  const { t } = useTranslation('applications')

  // INTERVIEW-FLOW-BINDING-1: this application's own flow override picker.
  const { options: flowOptions, loading: flowsLoading, error: flowsError } = useInterviewFlows(true)
  const [flowOverride, setFlowOverride] = useState<Id | null | undefined>(undefined)
  const currentFlowId = flowOverride !== undefined ? flowOverride : interviewFlowId ?? null
  const [flowSaving, setFlowSaving] = useState(false)
  const pickFlow = async (id: string) => {
    if (applicationId == null || flowSaving) return
    const nextId = id || null
    setFlowSaving(true)
    try {
      await api.patch(`/applications/${applicationId}`, { interview_flow_id: nextId })
      setFlowOverride(nextId)
      notifySuccess(t('interview.status.flowOverrideSaved'))
    } catch (err) {
      notifyError(extractApiError(err, t('common:actionFailed')))
    } finally {
      setFlowSaving(false)
    }
  }
  useEffect(() => { setFlowOverride(undefined) }, [interviewFlowId])

  // INTERVIEW-WORKFLOW-1: this application's own workflow override.
  const { options: workflowOptions, byId: workflowById, describe: describeWorkflow, loading: workflowsLoading, error: workflowsError } = useInterviewWorkflows(hasInterviewWorkflowField)
  const [workflowOverride, setWorkflowOverride] = useState<Id | null | undefined>(undefined)
  const currentWorkflowId = workflowOverride !== undefined ? workflowOverride : interviewWorkflowId ?? null
  // MEDIUM fix: the flow-override picker becomes read-only derived display once
  // a workflow is linked — the workflow resolves its own agent+flow.
  const isWorkflowLinked = hasInterviewWorkflowField && currentWorkflowId != null
  const linkedWorkflow = currentWorkflowId != null ? workflowById.get(String(currentWorkflowId)) : undefined
  const derivedAgentName = linkedWorkflow?.agent?.name ?? interviewWorkflow?.agent?.name ?? '—'
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

  // The override picker — an application-level binding, independent of
  // whether a live session exists, authorization-gated like stop/resume.
  const flowOverridePicker = canManage && applicationId != null && (
    isWorkflowLinked ? (
      // Derived display: the linked workflow resolves its own flow, so a
      // second, interactive flow picker here would contradict what runs.
      <div>
        <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 4 }}>{t('interview.status.flowOverrideLabel')}</GroupLabel>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>
          {t('vacancies:aiagent.workflow.derivedFrom', { agent: derivedAgentName, workflow: derivedWorkflowName })}
        </p>
      </div>
    ) : (
      <div>
        <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 4 }}>{t('interview.status.flowOverrideLabel')}</GroupLabel>
        <CreatableSelect
          value={currentFlowId != null ? String(currentFlowId) : null}
          onChange={pickFlow}
          allowCreate={false}
          clearable
          clearLabel={t('interview.status.flowOverrideLabel')}
          placeholder={flowsLoading ? t('common:loading') : t('interview.status.flowOverridePlaceholder')}
          options={flowOptions}
        />
        {/* §3 four states: a failed flows load says so — a silently empty picker
            reads as "no flows exist". */}
        {flowsError && <Caption as="div" style={{ color: 'var(--color-danger-text)' }}>{t('vacancies:aiagent.loadError')}</Caption>}
      </div>
    )
  )

  // INTERVIEW-WORKFLOW-1: the higher-level workflow override, presence-gated —
  // renders disabled with an honest notice for a tenant/backend not yet on
  // this contract, independent of whether a live session exists.
  const workflowOverridePicker = canManage && applicationId != null && (
    <InterviewWorkflowPicker
      value={currentWorkflowId}
      onChange={pickWorkflow}
      options={workflowOptions}
      loading={workflowsLoading}
      error={workflowsError}
      disabled={!hasInterviewWorkflowField}
      notice={hasInterviewWorkflowField ? undefined : t('vacancies:aiagent.workflow.unavailable')}
      linkedRef={interviewWorkflow}
      describe={describeWorkflow}
    />
  )

  return { flowOverridePicker, workflowOverridePicker }
}
