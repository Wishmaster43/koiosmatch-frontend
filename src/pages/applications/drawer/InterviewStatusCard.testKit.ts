/** Shared DATA fixtures for the InterviewStatusCard suites (plain data builders, no mocks). */
import type { ApplicationInterview } from '@/types/application'

// A fully-populated interview — every INTERVIEW-VISIBILITY-1 field present.
export const fullInterview = (overrides: Partial<ApplicationInterview> = {}): ApplicationInterview => ({
  category: 'busy', currentStatus: 'ACTIVE_IN_CARE', step: 2, total: 5,
  questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
  id: 'iv-1', agent: { id: 'a-1', name: 'Verpleegkundige-agent' }, flowName: 'Verpleegkundige intake', flowId: 'flow-1',
  turn: 'agent', startedAt: '2026-07-21T09:00:00Z', lastMessageAt: '2026-07-21T09:07:00Z', endedAt: null, durationSeconds: null,
  pausedAt: null, pausedBy: null,
  ...overrides,
})

// The LIST payload's shape: ApplicationListResource::interviewSummary sends only
// category/current_status/step/total — no session id, no visibility fields.
export const bareInterview: ApplicationInterview = {
  category: 'busy', currentStatus: 'X', step: 1, total: 3,
  questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
  id: null, agent: null, flowName: null, flowId: null, turn: null, startedAt: null, lastMessageAt: null, endedAt: null, durationSeconds: null,
  pausedAt: null, pausedBy: null,
}

// A raw `GET /applications/{id}` detail body carrying the interview block.
export const detailResponse = (interview: Record<string, unknown>) => ({ data: { data: { id: 'app-1', interview } } })
