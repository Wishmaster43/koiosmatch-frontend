// AUTH-BOOT-TRANSIENT-1: the boot probe retries transient failures and stops at an auth verdict.
import { describe, it, expect, vi } from 'vitest'
import { BootProbeAborted, isAuthVerdict, isTransientFailure, probeSessionWithRetry } from './authBootProbe'

const networkError = () => Object.assign(new Error('Network Error'), { response: undefined })
const status = (code: number) => Object.assign(new Error(`HTTP ${code}`), { response: { status: code } })

describe('isAuthVerdict', () => {
  it('is true only for 401, 403 and 419', () => {
    expect(isAuthVerdict(status(401))).toBe(true)
    expect(isAuthVerdict(status(403))).toBe(true)
    expect(isAuthVerdict(status(419))).toBe(true)
    expect(isAuthVerdict(status(500))).toBe(false)
    expect(isAuthVerdict(status(429))).toBe(false)
    expect(isAuthVerdict(networkError())).toBe(false)
    expect(isAuthVerdict(null)).toBe(false)
  })
})

describe('isTransientFailure', () => {
  it('is true without a response and for 408, 429 and 5xx, false for a deterministic 4xx', () => {
    expect(isTransientFailure(networkError())).toBe(true)
    expect(isTransientFailure(status(408))).toBe(true)
    expect(isTransientFailure(status(429))).toBe(true)
    expect(isTransientFailure(status(503))).toBe(true)
    expect(isTransientFailure(status(404))).toBe(false)
    expect(isTransientFailure(status(422))).toBe(false)
  })
})

describe('probeSessionWithRetry', () => {
  it('rejects at once on a deterministic 4xx without a retry or a sleep', async () => {
    const probe = vi.fn().mockRejectedValue(status(404))
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined)
    await expect(probeSessionWithRetry(probe, { delays: [10, 20], sleep })).rejects.toMatchObject({ response: { status: 404 } })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('resolves after transient failures, sleeping the configured delays between the attempts', async () => {
    const probe = vi.fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(status(503))
      .mockResolvedValueOnce('session')
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined)
    await expect(probeSessionWithRetry(probe, { delays: [10, 20, 40], sleep })).resolves.toBe('session')
    expect(probe).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map(c => c[0])).toEqual([10, 20])
  })

  it('rejects at once on an auth verdict without a retry or a sleep', async () => {
    const probe = vi.fn().mockRejectedValue(status(401))
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined)
    await expect(probeSessionWithRetry(probe, { delays: [10, 20], sleep })).rejects.toMatchObject({ response: { status: 401 } })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('rejects with the last error once the delays are spent', async () => {
    const probe = vi.fn().mockRejectedValue(status(502))
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined)
    await expect(probeSessionWithRetry(probe, { delays: [10, 20], sleep })).rejects.toMatchObject({ response: { status: 502 } })
    expect(probe).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('stops with BootProbeAborted when the owner is gone after a backoff, without probing again', async () => {
    const probe = vi.fn().mockRejectedValue(networkError())
    let alive = true
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => { alive = false })
    await expect(probeSessionWithRetry(probe, { delays: [10, 20], sleep, isAlive: () => alive })).rejects.toBeInstanceOf(BootProbeAborted)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('probes exactly once and never sleeps when no delays are configured', async () => {
    const probe = vi.fn().mockRejectedValue(networkError())
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined)
    await expect(probeSessionWithRetry(probe, { delays: [], sleep })).rejects.toThrow('Network Error')
    expect(probe).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})
