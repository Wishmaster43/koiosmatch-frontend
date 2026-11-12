/**
 * useOffboardingState — decides whether the shell shows the offboarding wall.
 * True when /auth/me says the active bureau is being offboarded, or an API call
 * answered 423 tenant_offboarding (offboardingGate).
 */
import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOffboardingGateState, resetOffboardingGate, subscribeOffboardingGate } from '@/lib/offboardingGate'

// Grace/queued/running mean the bureau is suspended; failed/finished/cancelled do not.
const ACTIVE_STATUSES = ['grace', 'running', 'queued']

interface TenantOffboardingFields {
  provisioning_status?: string | null
  offboarding_due_at?: string | null
  offboarding_status?: string | null
}

export interface OffboardingState { offboarding: boolean; dueAt: string | null }

export function useOffboardingState(): OffboardingState {
  const auth = useAuth()
  const gate = useSyncExternalStore(subscribeOffboardingGate, getOffboardingGateState)
  const user = auth?.user ?? null
  // A fresh session starts clean: sign-out drops a flag raised by the previous bureau.
  useEffect(() => { if (!user) resetOffboardingGate() }, [user])
  if (!user) return { offboarding: false, dueAt: null }
  const tenant = (user.tenant ?? auth?.activeTenant ?? null) as TenantOffboardingFields | null
  const dueAt = tenant?.offboarding_due_at || null
  const fromMe = !!dueAt || tenant?.provisioning_status === 'offboarding'
    || ACTIVE_STATUSES.includes(tenant?.offboarding_status ?? '')
  if (fromMe) return { offboarding: true, dueAt }
  return { offboarding: gate.active, dueAt: gate.dueAt }
}
