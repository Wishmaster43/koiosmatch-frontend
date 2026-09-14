/**
 * OutgoingWebhooks — container for the outgoing event subscriptions. Owns the
 * list state and switches between list and a single subscription's detail (same
 * list↔detail pattern as the API-keys section). Data flows through the hook so
 * the table stays in sync after create / edit / delete. The WorkflowEndpointsCard
 * mounts at the bottom, so both the subscription list and the endpoint configs
 * are visible/editable on the same page.
 */
import { useState } from 'react'
import { useWebhookSubscriptions } from './useWebhookSubscriptions'
import WebhookList, { type WebhookSubscriptionRow } from './WebhookList'
import WebhookDetail from './WebhookDetail'
import WebhookCreate from './WebhookCreate'
import WorkflowEndpointsCard from './WorkflowEndpointsCard'

export default function OutgoingWebhooks() {
  // useWebhookSubscriptions() reads its row type from the still-untyped
  // useWebhookSubscriptions.js — cast once at this boundary (house precedent:
  // apikeys/index.tsx), payload types stay unknown since the real shapes
  // (WebhookSubscriptionCreated/WebhookSubscriptionRow) are owned by the callees.
  const { subs, loading, error, reload, add, patch, drop } = useWebhookSubscriptions() as {
    subs: WebhookSubscriptionRow[]
    loading: boolean
    error: boolean
    reload: () => void
    add: (item: unknown) => void
    patch: (id: string, merged: unknown) => void
    drop: (id: string) => void
  }
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Create view replaces the list (inline, no modal) — same pattern as detail.
  if (creating) {
    return <WebhookCreate onBack={() => setCreating(false)} onCreated={add} />
  }

  // Detail replaces the list while a subscription is open.
  if (selectedId) {
    return (
      <WebhookDetail
        subId={selectedId}
        listRow={subs.find((s) => s.id === selectedId)}
        onBack={() => setSelectedId(null)}
        onPatch={patch}
        onDelete={(id: string) => { drop(id); setSelectedId(null) }}
      />
    )
  }

  return (
    <>
      <WebhookList
        subs={subs}
        loading={loading}
        error={error}
        onReload={reload}
        onOpen={setSelectedId}
        onNew={() => setCreating(true)}
      />
      <div style={{ marginTop: 32 }}>
        <WorkflowEndpointsCard />
      </div>
    </>
  )
}
