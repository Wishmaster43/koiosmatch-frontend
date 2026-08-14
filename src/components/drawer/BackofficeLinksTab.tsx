/**
 * BackofficeLinksTab ("Koppelingen") — the HelloFlex + Shiftmanager cards shared by
 * every entity that carries `backoffice_links[]` (candidates, customers, locations,
 * departments, contacts, matches — EXTRACT-1, KOPPELINGEN-META-1). Both systems link
 * through the same generic POST /sync/{entity}/{id} { system } endpoint, which also
 * stamps who/when the link was FIRST made. Extracted verbatim from the candidate
 * IntegrationsTab (§3A/§11: one shared component, adopted everywhere, never copied) —
 * the candidate tab keeps its own PDOK card and renders this component around it via
 * `children`. No fake affordances (§3): every button here fires a real request; the
 * "Koppelen"/"Opnieuw koppelen" buttons render disabled when the caller's own
 * permission check (`canLink`) is false — the backend still re-checks regardless.
 * Card bodies live in backofficeLinkCards.tsx (§3 size discipline); this file only
 * wires the app gate + the two mutations (link / sync-now).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useApps } from '@/context/AppsContext'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError, apiErrorKey } from '@/lib/extractApiError'
import { useTranslation } from 'react-i18next'
import { HelloflexCard, ShiftmanagerCard } from './backofficeLinkCards'
import type { BackofficeLink } from '@/lib/backofficeLink'
import type { Id } from '@/types/common'
import type { operations } from '@/types/api-generated'

export { CardTitle } from './backofficeLinkCards'

type BackofficeSystem = 'helloflex' | 'shiftmanager'
// Request body typed from the OpenAPI spec (§10 type-gen adoption) — the ONE
// generic sync endpoint both systems share (paths['/api/sync/{entity}/{id}']).
type SyncBody = operations['postSyncEntityId']['requestBody']['content']['application/json']

export interface BackofficeLinksTabProps {
  // URL plural token the generic sync endpoint expects: candidates/customers/
  // locations/departments/contacts/matches (§0.10 endpoint naming).
  entity: string
  id: Id
  helloflexLink: BackofficeLink | null
  shiftmanagerLink: BackofficeLink | null
  // The caller's own permission check (customers.update / matches.update / …,
  // per entity — see BackofficeEntityRegistry). The "Koppelen" buttons render
  // disabled, never gone, when false; the backend re-checks regardless (§7).
  canLink: boolean
  // Entity-specific extra cards rendered ABOVE HelloFlex/Shiftmanager (mirrors the
  // candidate's PDOK card, which stays candidate-only and is passed in here).
  children?: ReactNode
}

export default function BackofficeLinksTab({ entity, id, helloflexLink, shiftmanagerLink, canLink, children }: BackofficeLinksTabProps) {
  const { t } = useTranslation('common')
  // GATING-MATRIX (Danny 23-07): the koppel-cards gate on the CONNECTOR APP ONLY —
  // the sm/hf MODULE is the read/reports side and must NOT reveal the koppelen
  // surface (Yesway: hf module on, hf app off → no HelloFlex card).
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)
  const showHelloflex = isAppEnabled('hf')
  const showShiftmanager = isAppEnabled('shiftmanager')

  // Start-linking: the ONE generic POST both systems share, entity-agnostic via
  // the `entity` URL token. Optimistic: a spinner while in flight, then the 202's
  // `pending` snapshot overlays the card locally until the record is refetched
  // with the real linked/failed result. Never fires on its own (§13), and never
  // fires at all once `canLink` is false.
  const [linking, setLinking] = useState<Partial<Record<BackofficeSystem, boolean>>>({})
  const [queuedStatus, setQueuedStatus] = useState<Partial<Record<BackofficeSystem, string>>>({})
  const onLink = async (system: BackofficeSystem) => {
    if (linking[system] || !canLink) return
    setLinking(s => ({ ...s, [system]: true }))
    try {
      const body: SyncBody = { system }
      const { data } = await api.post(`/sync/${entity}/${id}`, body)
      setQueuedStatus(s => ({ ...s, [system]: data?.link?.status ?? 'pending' }))
      notifySuccess(t('backofficeLinks.common.linkStarted'))
    } catch (err) {
      // HF-CONTRACTMAP-1: an unmapped contract form is an honest, actionable notice
      // (points at Settings → HelloFlex), never the raw 409 server message.
      const key = apiErrorKey(err)
      notifyError(key ? t(key) : extractApiError(err, t('backofficeLinks.common.linkFailed')))
    } finally {
      setLinking(s => ({ ...s, [system]: false }))
    }
  }

  // Manual "Nu synchroniseren" (Shiftmanager only, once linked) — its own lightweight
  // one-off endpoint, entity-prefixed per the sm_ naming convention (§0.10):
  // POST /sm_{entity}/sync/{externalId}. Only ONE of those routes exists today
  // (grepped from the generated OpenAPI spec, 28-07). Rendering the button for the
  // other entities would ship a control that fails 404 on every single click — an
  // error toast does not make a dead button honest (§3 "no fake affordances"), so it
  // simply is not offered until the route lands. Add the entity here the day it does.
  const SM_SYNC_ROUTES = ['candidates']
  const canSyncNow = SM_SYNC_ROUTES.includes(entity)
  const smExternalId = shiftmanagerLink?.status === 'linked' ? shiftmanagerLink.externalId ?? null : null
  const [syncing, setSyncing] = useState(false)
  const onSyncNow = async () => {
    if (!smExternalId || syncing || !canSyncNow) return
    setSyncing(true)
    try {
      await api.post(`/sm_${entity}/sync/${smExternalId}`)
      notifySuccess(t('backofficeLinks.shiftmanager.syncSuccess'))
    } catch (err) {
      notifyError(extractApiError(err, t('backofficeLinks.shiftmanager.syncFailed')))
    } finally {
      setSyncing(false)
    }
  }

  // Effective status per system: the just-clicked optimistic overlay wins, else
  // the mapped link's real status, else "never attempted" (null).
  const hfStatus = queuedStatus.helloflex ?? helloflexLink?.status ?? null
  const smStatus = queuedStatus.shiftmanager ?? shiftmanagerLink?.status ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {children}
      {showHelloflex && (
        <HelloflexCard status={hfStatus} link={helloflexLink} canLink={canLink}
          busy={!!linking.helloflex} onLink={() => onLink('helloflex')} />
      )}
      {showShiftmanager && (
        <ShiftmanagerCard status={smStatus} link={shiftmanagerLink} canLink={canLink}
          busy={!!linking.shiftmanager} syncing={syncing} canSyncNow={canSyncNow}
          onLink={() => onLink('shiftmanager')} onSyncNow={onSyncNow} />
      )}
    </div>
  )
}
