/**
 * workflowApi tests — the base-URL resolver falls back to VITE_API_URL when
 * VITE_WORKFLOW_API_URL is unset, and uses the workflow-specific var when set
 * (K-3: workflow-execution endpoints must be redirectable via env var alone).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveWorkflowBaseURL } from './workflowApi'

describe('resolveWorkflowBaseURL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to VITE_API_URL when VITE_WORKFLOW_API_URL is unset', () => {
    vi.stubEnv('VITE_WORKFLOW_API_URL', undefined)
    vi.stubEnv('VITE_API_URL', 'http://koiosmatch-api.test/api')
    expect(resolveWorkflowBaseURL()).toBe('http://koiosmatch-api.test/api')
  })

  it('uses VITE_WORKFLOW_API_URL when set', () => {
    vi.stubEnv('VITE_WORKFLOW_API_URL', 'http://koiosmatch-workflow-engine.test/api')
    vi.stubEnv('VITE_API_URL', 'http://koiosmatch-api.test/api')
    expect(resolveWorkflowBaseURL()).toBe('http://koiosmatch-workflow-engine.test/api')
  })

  // An EMPTY string is a real deploy footgun (an unset env var interpolated into a
  // blank build arg) and must still fall through — `??` only skips null/undefined,
  // so the resolver uses `||` truthiness instead.
  it('falls back to VITE_API_URL when VITE_WORKFLOW_API_URL is an EMPTY string', () => {
    vi.stubEnv('VITE_WORKFLOW_API_URL', '')
    vi.stubEnv('VITE_API_URL', 'http://koiosmatch-api.test/api')
    expect(resolveWorkflowBaseURL()).toBe('http://koiosmatch-api.test/api')
  })
})
