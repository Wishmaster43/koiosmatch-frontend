/**
 * useProposalCvConfirm — the CV glue of the Koios pending-action card (PROPOSAL-CV-PANEL-1).
 * For a propose_application action with a known application it makes sure a clean proposal CV
 * exists before the confirm POST, and reads the server's invalid_override answer.
 */
import { Component, createElement, lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { canonicalToolId } from './koiosToolIds'
import type { KoiosPendingAction } from './koiosTypes'
import type { EnsureProposalCv } from './EnsureProposalCvHost'

// Lazy host for the CV ensure hook, so its dependency graph stays out of the entry bundle.
const EnsureProposalCvHost = lazy(() => import('./EnsureProposalCvHost'))

// Marks a CV preparation failure so the confirm catch can tell it from a server answer.
export class PrepareFailure extends Error {}

// Catches a failed lazy chunk load so the card falls back to a bodyless confirm (server fallback).
class HostBoundary extends Component<{ onFail: () => void; children?: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFail() }
  render() { return this.state.failed ? null : this.props.children }
}

// Returns the CV state, the prepare/override helpers and the lazy host element for the card.
export function useProposalCvConfirm(action: KoiosPendingAction) {
  const { t } = useTranslation('common')
  // The published ensure function, boxed so a function value is not mistaken for a state updater.
  const [ensure, setEnsure] = useState<{ fn: EnsureProposalCv } | null>(null)
  const [hostFailed, setHostFailed] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [overrideInvalid, setOverrideInvalid] = useState(false)
  const applicationId = action.entity_ref?.application_id ?? null
  const needsCv = canonicalToolId(action.tool) === 'propose_application' && !!applicationId

  // Receives (or withdraws) the ensure function the lazy host publishes.
  const onEnsureReady = useCallback((fn: EnsureProposalCv | null) => setEnsure(fn ? { fn } : null), [])
  const onHostFail = useCallback(() => setHostFailed(true), [])

  // Ensures the CV and returns the confirm body; undefined when no CV step applies.
  const prepareBody = useCallback(async (): Promise<{ cv_document_id: string } | undefined> => {
    setOverrideInvalid(false)
    if (!needsCv || !applicationId || !ensure) return undefined
    setPreparing(true)
    try {
      return { cv_document_id: await ensure.fn(applicationId) }
    } catch (prepErr: unknown) {
      throw new PrepareFailure(prepErr instanceof Error ? prepErr.message : t('notesAssist.proposeCv.prepareFailed'))
    } finally {
      setPreparing(false)
    }
  }, [needsCv, applicationId, ensure, t])

  // True when the server rejected the chosen CV (card stays pending, retry allowed).
  const handleOverrideError = useCallback((e: { response?: { status?: number; data?: { status?: string } } } | undefined): boolean => {
    const invalid = e?.response?.status === 422 && e.response.data?.status === 'invalid_override'
    if (invalid) setOverrideInvalid(true)
    return !!invalid
  }, [])

  const host: ReactNode = needsCv && !hostFailed
    ? createElement(HostBoundary, { onFail: onHostFail },
      createElement(Suspense, { fallback: null }, createElement(EnsureProposalCvHost, { onReady: onEnsureReady })))
    : null
  return { needsCv, ready: !needsCv || ensure != null || hostFailed, preparing, overrideInvalid, prepareBody, handleOverrideError, host }
}
