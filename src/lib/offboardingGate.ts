/**
 * offboardingGate — remembers that the active bureau is being offboarded.
 * Any API answer 423 {code:'tenant_offboarding'} flips a module-level flag the app
 * shell reads through useSyncExternalStore. The interceptor is registered from a
 * boot call (never at import time) so tests stay side-effect free.
 */
import type { AxiosInstance } from 'axios'

export const TENANT_OFFBOARDING_CODE = 'tenant_offboarding'

export interface OffboardingGateState { active: boolean; dueAt: string | null }

const IDLE: OffboardingGateState = { active: false, dueAt: null }
let state: OffboardingGateState = IDLE
const listeners = new Set<() => void>()

// Replaces the state and wakes every subscriber (snapshot identity changes only on a real change).
const setState = (next: OffboardingGateState) => {
  if (next.active === state.active && next.dueAt === state.dueAt) return
  state = next
  listeners.forEach(l => l())
}

// useSyncExternalStore contract: subscribe + stable snapshot.
export const subscribeOffboardingGate = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getOffboardingGateState = (): OffboardingGateState => state

// Clears the flag (sign-out, or a bureau switch).
export const resetOffboardingGate = () => setState(IDLE)

// Inspects a rejected request; a 423 with the offboarding code raises the flag. Always returns nothing, the caller re-rejects.
export function detectOffboarding(error: unknown): void {
  const res = (error as { response?: { status?: number; data?: { code?: string; offboarding_due_at?: string | null } } } | null)?.response
  if (res?.status !== 423 || res.data?.code !== TENANT_OFFBOARDING_CODE) return
  const due = res.data.offboarding_due_at
  setState({ active: true, dueAt: typeof due === 'string' && due ? due : null })
}

let registered: { client: AxiosInstance; id: number } | null = null

// Adds the response interceptor once per client (HMR/StrictMode safe); the rejection is passed on untouched.
export function registerOffboardingGate(client: AxiosInstance): void {
  if (registered?.client === client) return
  if (registered) registered.client.interceptors.response.eject(registered.id)
  const id = client.interceptors.response.use(r => r, (error: unknown) => {
    detectOffboarding(error)
    return Promise.reject(error)
  })
  registered = { client, id }
}
