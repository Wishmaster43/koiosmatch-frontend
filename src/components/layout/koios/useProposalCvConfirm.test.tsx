import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { useProposalCvConfirm, PrepareFailure } from './useProposalCvConfirm'
import type { KoiosPendingAction } from './koiosTypes'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
const mockEnsure = vi.fn()
vi.mock('./EnsureProposalCvHost', async () => {
  const { useEffect } = await import('react')
  const Host = ({ onReady }: { onReady: (fn: unknown) => void }) => { useEffect(() => { onReady(mockEnsure); return () => onReady(null) }, [onReady]); return null }
  return { default: Host }
})

const make = (over: Partial<KoiosPendingAction> = {}, appId: string | null = 'a1'): KoiosPendingAction => ({
  id: 'pa1', tool: 'propose_application', title: 't',
  entity_ref: { type: 'application', id: 'x', label: 'l', application_id: appId ?? undefined },
  preview: [], destructive: false, expires_at: new Date(Date.now() + 60000).toISOString(), ...over,
} as KoiosPendingAction)

let api: ReturnType<typeof useProposalCvConfirm>
function Probe({ action }: { action: KoiosPendingAction }) {
  const h = useProposalCvConfirm(action)
  // Publish the latest hook value to the test after each render.
  useEffect(() => { api = h })
  return <>{h.host}<span data-testid="ready">{String(h.ready)}</span></>
}

describe('useProposalCvConfirm', () => {
  beforeEach(() => { mockEnsure.mockReset() })

  it('needs a CV for propose_application (also the legacy id) with an application id, and is ready once the host published', async () => {
    render(<Probe action={make({ tool: 'voorstel_sollicitatie' })} />)
    expect(api.needsCv).toBe(true)
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))
  })

  it('needs no CV and is ready at once without an application id or for another tool', () => {
    render(<Probe action={make({}, null)} />)
    expect(api.needsCv).toBe(false)
    expect(api.ready).toBe(true)
  })

  it('needs no CV for another tool even with an application id', () => {
    render(<Probe action={make({ tool: 'other_tool' })} />)
    expect(api.needsCv).toBe(false)
  })

  it('prepareBody ensures the CV for the application id and returns {cv_document_id}', async () => {
    mockEnsure.mockResolvedValue('d1')
    render(<Probe action={make()} />)
    await waitFor(() => expect(api.ready).toBe(true))
    let body: unknown
    await act(async () => { body = await api.prepareBody() })
    expect(mockEnsure).toHaveBeenCalledWith('a1')
    expect(body).toEqual({ cv_document_id: 'd1' })
    expect(api.preparing).toBe(false)
  })

  it('prepareBody returns undefined when no CV step applies', async () => {
    render(<Probe action={make({ tool: 'other_tool' })} />)
    let body: unknown = 'x'
    await act(async () => { body = await api.prepareBody() })
    expect(body).toBeUndefined()
    expect(mockEnsure).not.toHaveBeenCalled()
  })

  it('prepareBody throws a PrepareFailure carrying the message when ensure fails', async () => {
    mockEnsure.mockRejectedValue(new Error('boom'))
    render(<Probe action={make()} />)
    await waitFor(() => expect(api.ready).toBe(true))
    let err: unknown
    await act(async () => { try { await api.prepareBody() } catch (e) { err = e } })
    expect(err).toBeInstanceOf(PrepareFailure)
    expect((err as Error).message).toBe('boom')
    expect(api.preparing).toBe(false)
  })

  it('handleOverrideError flags only a 422 invalid_override and the next prepare clears it', async () => {
    render(<Probe action={make()} />)
    await waitFor(() => expect(api.ready).toBe(true))
    let hit = true
    act(() => { hit = api.handleOverrideError({ response: { status: 422, data: { status: 'declined' } } }) })
    expect(hit).toBe(false)
    expect(api.overrideInvalid).toBe(false)
    act(() => { hit = api.handleOverrideError({ response: { status: 422, data: { status: 'invalid_override' } } }) })
    expect(hit).toBe(true)
    expect(api.overrideInvalid).toBe(true)
    mockEnsure.mockResolvedValue('d1')
    await act(async () => { await api.prepareBody() })
    expect(api.overrideInvalid).toBe(false)
  })
})
