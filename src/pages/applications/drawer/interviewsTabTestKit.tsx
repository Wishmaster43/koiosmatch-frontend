/**
 * Shared test kit for the InterviewsTab suites (INTERVIEWS-SPLIT-1): helpers moved
 * verbatim from InterviewsTab.test.tsx. Not a test file; vi.mock blocks stay per file.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InterviewsTab from './InterviewsTab'
import type { ApplicationDetail } from '@/types/application'

export const defaultOptionsResult = () => ({
  workflowOptions: [], workflowById: new Map(), describeWorkflow: () => null,
  loading: false, error: false, forbidden: false,
})

// A minimal ApplicationDetail — mapApplicationDetail is defensive, so only the
// fields under test need to be populated.
export const app = (over: Partial<ApplicationDetail> = {}) =>
  ({ id: 'app-1', bucket: 'active', interview: null, interviews: [], ...over } as unknown as ApplicationDetail)

// Renders with a QueryClientProvider — the underlying useInterviewOptions hook
// needs one (mirrors VacancyAgentTab.test.tsx's harness for the same kind of hook).
export const renderTab = (application: ApplicationDetail) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><InterviewsTab application={application} /></QueryClientProvider>)
}

// An own-workflow override with an agent — the common "effective workflow
// resolved" fixture for most 200/201/409/422 cases below.
export const OWN_WF = { id: 'wf-own', name: 'Own workflow', agent: { id: 'a-own', name: 'Own agent' } }

// Click Start on an application whose effective workflow already resolved —
// every 200/201/409/422 case below drives this same UI path, only the mocked
// POST result differs.
export const clickStart = async () => {
  const user = userEvent.setup()
  await waitFor(() => screen.getByRole('button', { name: 'interview.start.label' }))
  await user.click(screen.getByRole('button', { name: 'interview.start.label' }))
}
