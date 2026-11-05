/**
 * useWorkflowsData — regression tests for re-audit findings that moved along with
 * the WorkflowsPage extraction: createFolder/moveToFolder used to fail SILENTLY
 * (unlike the sibling handleToggleStatus rollback, which toasts), and handleSave
 * used to interpolate the RAW axios/network message into the user-facing alert
 * instead of routing it through the shared extractApiError helper (§10 — never
 * leak a raw server/axios string to the UI). `unwrap`/`unwrapList` stay the real
 * (pure) implementations; only the axios-like client is mocked.
 *
 * D8 re-audit (14-09): handleSave/the add-module guard used window.alert() —
 * a blocking native dialog instead of the house toast every other mutation in
 * this hook uses; handleRun's success path was empty (no feedback, no refetch);
 * and the list-load effect had no alive guard. All three fixed; the toast fix is
 * asserted here, handleRun's success path in useWorkflowsData.run.test.ts and the
 * alive guard in useWorkflowsData.lifecycle.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkflowsData } from './useWorkflowsData'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
// Auto-confirm every staged confirmation so archive's confirm-gated call fires
// synchronously in tests, without rendering the real ConfirmDialog.
vi.mock('@/hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: (_msg: string, onConfirm: () => void) => onConfirm(), dialog: null }),
}))
// Minimal i18n stub that still interpolates {{msg}}-style options so handleSave's
// notifyError(t('page.saveFailed', { msg })) stays inspectable in the assertions below.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.msg ? `${key}::${opts.msg}` : key) }),
}))

import api from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
const mockedGet    = vi.mocked(api.get)
const mockedPost   = vi.mocked(api.post)
const mockedPut    = vi.mocked(api.put)

afterEach(() => vi.clearAllMocks())

// One seeded workflow + folder so folder-move / save-existing tests have a real target row.
function seedList() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/workflows') {
      return Promise.resolve({ data: { data: [
        { id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] },
      ] } })
    }
    if (url === '/workflow-folders') return Promise.resolve({ data: { data: [{ id: 'f1', name: 'Onboarding' }] } })
    return Promise.resolve({ data: { data: [] } })
  })
}

describe('useWorkflowsData · createFolder failure feedback', () => {
  it('notifies on a failed create instead of failing silently (finding: catch-noop)', async () => {
    seedList()
    mockedPost.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.createFolder('New folder') })

    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
  })
})

describe('useWorkflowsData · moveToFolder failure feedback', () => {
  it('rolls back the optimistic move AND notifies (mirrors handleToggleStatus, was a silent rollback)', async () => {
    seedList()
    mockedPut.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.moveToFolder('wf-1', 'f1') })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('common:actionFailed'))
    expect(result.current.workflows.find(w => w.id === 'wf-1')?.folder_id).toBeUndefined()
  })
})

describe('useWorkflowsData · handleSave error message (never raw axios/network text)', () => {
  it('falls back through extractApiError + i18n fallback for a network-style failure', async () => {
    seedList()
    mockedPut.mockRejectedValue(new Error('Request failed with status code 500'))
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] })
    })

    // The raw axios message ("Request failed with status code 500") must never reach the user,
    // and it goes through the house toast (notifyError), never a blocking window.alert (D8 re-audit).
    expect(notifyError).toHaveBeenCalledWith('page.saveFailed::common:actionFailed')
  })

  it('still surfaces the specific 422 validation detail (WF-R2 functional flow preserved)', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { data: { message: 'The given data was invalid.', errors: { steps: ['Step 2 has no connection.'] } } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] })
    })

    expect(notifyError).toHaveBeenCalledWith('page.saveFailed::Step 2 has no connection.')
  })

  it('surfaces a flat 422 message (no errors bag) verbatim — X-22 webhook_send validation', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { data: { message: "Stap 2 ('Stuur naar Elanza'): De webhook-URL mag niet naar een intern of privé-adres wijzen." } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [{ id: 's1', type: 'webhook_send' }] })
    })

    expect(notifyError).toHaveBeenCalledWith("page.saveFailed::Stap 2 ('Stuur naar Elanza'): De webhook-URL mag niet naar een intern of privé-adres wijzen.")
  })

  // INTERVIEW-FLAG-1: the BE's fixed-key 422 (is_interview without an agent step)
  // maps to its own i18n key, never showing the raw backend message.
  it('maps the workflow.interview_requires_agent_step 422 to its own i18n key', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { data: { message: 'workflow.interview_requires_agent_step' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', is_interview: true, steps: [{ id: 's1', type: 'email_send' }] })
    })

    expect(notifyError).toHaveBeenCalledWith('page.saveFailed::editor.interviewRequiresAgentStep')
  })

  // INTERVIEW-FLAG-1: is_interview rides verbatim in the PUT body at the real seam
  // (denormalizeWorkflow -> api.put), not only one layer up in the onSave argument.
  it('sends is_interview in the PUT body when the workflow carries it', async () => {
    seedList()
    mockedPut.mockResolvedValue({ data: { data: { id: 'wf-1' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', is_interview: true, steps: [{ id: 's1', type: 'email_send' }] })
    })

    expect(mockedPut).toHaveBeenCalledWith('/workflows/wf-1', expect.objectContaining({ is_interview: true }))
  })

  // D8 re-audit: the empty-graph guard used window.alert() too — now the house
  // 'info' toast, matching every other non-error notice in this hook.
  it('the empty-graph guard notifies via the house toast, not window.alert', async () => {
    seedList()
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved: boolean | undefined
    await act(async () => {
      saved = await result.current.handleSave({ id: 'wf-1', name: 'Welcome flow', status: 'active', steps: [] })
    })

    expect(saved).toBe(false)
    expect(notify).toHaveBeenCalledWith('info', 'page.addModuleAlert')
    expect(mockedPut).not.toHaveBeenCalled()
  })
})

// AIK-02 (contract audit 09-09): the list-row switch and the folder drag send a
// PARTIAL PUT — the old full payload was rebuilt from the list row and re-tagged an
// event workflow as a daily 09:00 schedule on every flip.
describe('useWorkflowsData · list mutations are partial PUTs (AIK-02)', () => {
  it('handleToggleStatus PUTs only status + active', async () => {
    seedList()
    mockedPut.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleToggleStatus(result.current.workflows[0]) })

    await waitFor(() => expect(mockedPut).toHaveBeenCalledWith('/workflows/wf-1', { status: 'inactive', active: false }))
  })

  it('moveToFolder PUTs only folder_id', async () => {
    seedList()
    mockedPut.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.moveToFolder('wf-1', 'f1') })

    await waitFor(() => expect(mockedPut).toHaveBeenCalledWith('/workflows/wf-1', { folder_id: 'f1' }))
  })

  // AIK-05: the backend's precise 422 reason reaches the planner, not one anonymous toast.
  it('handleToggleStatus surfaces the server reason on a 422', async () => {
    seedList()
    mockedPut.mockRejectedValue({ response: { status: 422, data: { message: 'Geen geldige vertrekmodule.' } } })
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.handleToggleStatus(result.current.workflows[0]) })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Geen geldige vertrekmodule.'))
  })
})

// I-001: a coded 422 reaches the user as the translated common error on both write paths.
describe('useWorkflowsData · ai_disclosure_missing is translated, never the raw sentence', () => {
  const coded = { response: { status: 422, data: { code: 'ai_disclosure_missing', message: 'NL zin' } } }

  it('handleToggleStatus PUTs {status, active} and toasts the translated key on refusal', async () => {
    seedList()
    mockedPut.mockRejectedValue(coded)
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const wf = { ...result.current.workflows[0], status: 'inactive' }

    await act(async () => { result.current.handleToggleStatus(wf) })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('errors.aiDisclosureMissing'))
    expect(mockedPut).toHaveBeenCalledWith('/workflows/wf-1', { status: 'active', active: true })
    expect(notifyError).not.toHaveBeenCalledWith('NL zin')
  })

  it('handleSave (create) POSTs /workflows and toasts the translated key inside saveFailed', async () => {
    seedList()
    mockedPost.mockRejectedValue(coded)
    const { result } = renderHook(() => useWorkflowsData(false))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.handleSave({ name: 'New flow', status: 'active', steps: [{ id: 's1', type: 'email_send' }] }) })

    expect(mockedPost).toHaveBeenCalledWith('/workflows', expect.objectContaining({ name: 'New flow' }))
    expect(notifyError).toHaveBeenCalledWith('page.saveFailed::errors.aiDisclosureMissing')
  })
})
