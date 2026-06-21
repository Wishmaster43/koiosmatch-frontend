/**
 * OutgoingWebhooks — container for the outgoing event subscriptions. Owns the
 * list state and switches between list and a single subscription's detail (same
 * list↔detail pattern as the API-keys section). Data flows through the hook so
 * the table stays in sync after create / edit / delete.
 */
import { useState } from 'react'
import { useWebhookSubscriptions } from './useWebhookSubscriptions'
import WebhookList from './WebhookList'
import WebhookDetail from './WebhookDetail'
import WebhookCreate from './WebhookCreate'

export default function OutgoingWebhooks() {
  const { subs, loading, error, reload, add, patch, drop } = useWebhookSubscriptions()
  const [selectedId, setSelectedId] = useState(null)
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
        onDelete={(id) => { drop(id); setSelectedId(null) }}
      />
    )
  }

  return (
    <WebhookList
      subs={subs}
      loading={loading}
      error={error}
      onReload={reload}
      onOpen={setSelectedId}
      onNew={() => setCreating(true)}
    />
  )
}
