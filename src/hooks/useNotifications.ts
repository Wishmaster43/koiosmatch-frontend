/**
 * useNotifications — graceful notifications feed for the topbar bell.
 *
 * Polls GET /notifications; the list stays empty (no badge) until the backend
 * feed exists, so the bell never breaks. Seen-state is persisted best-effort via
 * POST /notifications/seen, with an optimistic local update so the badge clears
 * immediately on open. Never logs PII (§8).
 *
 * NOTIF-ATTENTION-V1: a bell alone is not enough (Danny) — a row that is NEW
 * since the previous poll (unseen, not present last tick) also fires an
 * "attention" toast (title + click-to-open + new-tab icon for resolvable rows),
 * using the SAME resolveNotificationTarget mapping the bell uses, capped at 3
 * individual toasts per tick with a summary toast for the rest. A soft chime
 * plays once per tick that produced attention toasts, gated by the
 * `notif_sound_enabled` user setting (default on).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserPreference } from '@/hooks/useUserPreference'
import api, { unwrapList } from '@/lib/api'
import { notify } from '@/lib/notify'
import { playNotificationChime } from '@/lib/notificationSound'
import {
  resolveNotificationTarget, navigateToNotificationTarget, buildNotificationDeepLink, resolveActionLine,
} from '@/components/layout/notificationTarget'

export interface AppNotification {
  id: string | number
  title?: string
  body?: string
  created_at?: string
  seen?: boolean
  link?: string
  // NOTIF-PAYLOAD (CMBE 8f0fcdb8): the backend-resolved click-through target,
  // stored on every row; action_status/next_action only set for a workflow-run
  // notification (NotificationController::index).
  entity_type?: string | null
  entity_id?: string | null
  url?: string | null
  action_status?: string | null
  next_action?: string | null
  [k: string]: unknown
}

const MAX_INDIVIDUAL_TOASTS = 3
const ATTENTION_TOAST_DURATION = 10000

// Tick guard — skip a poll while the browser tab is hidden (mirrors useQueueSummary's
// "never hammer an idle background tab"). Extracted so it is unit-testable in isolation
// from the interval/effect wiring.
export function shouldPollNotifications(visibilityState: DocumentVisibilityState = document.visibilityState): boolean {
  return visibilityState === 'visible'
}

export function useNotifications(pollMs = 60000) {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<AppNotification[]>([])
  // Ids already known from a previous tick — the first load never fires toasts
  // (that would replay the whole feed as "new" on every page load).
  const knownIds = useRef<Set<string> | null>(null)
  // Per-USER preference off the profile the app already has (ui_preferences,
  // AuthContext) — never the tenant-wide settings blob (Opus wave-B1 BLOCKER:
  // one user's mute must not silence the whole tenant).
  const [soundEnabled] = useUserPreference<boolean>('notif_sound_enabled', true)
  const soundEnabledRef = useRef(soundEnabled)
  // Refs must never be written during render (react-hooks/refs) — sync in an effect.
  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  // Load the feed; any failure (incl. a missing endpoint) resolves to empty.
  // Detects rows new since the previous successful poll and raises attention
  // toasts (+ one chime) for them.
  const load = useCallback(() => {
    api.get('/notifications')
      .then(r => {
        const rows = (unwrapList(r).rows) as AppNotification[]
        setItems(rows)
        const isFirstLoad = knownIds.current === null
        const nextKnown = new Set(rows.map(n => String(n.id)))
        if (!isFirstLoad) {
          const prevKnown = knownIds.current!
          // Age guard (Opus wave-B1): an unseen row that merely SHIFTS into the
          // bounded feed window (deleted sibling, re-sort) is not NEW — announce
          // only rows actually created around the last poll window; a missing or
          // unparseable created_at is never "new" (§0B: an assistant that
          // re-announces what the user already had erodes trust).
          const freshCutoffMs = pollMs * 2
          const isRecent = (n: AppNotification) => {
            const ts = n.created_at ? new Date(n.created_at).getTime() : NaN
            return Number.isFinite(ts) && Date.now() - ts <= freshCutoffMs
          }
          const freshUnseen = rows.filter(n => !n.seen && !prevKnown.has(String(n.id)) && isRecent(n))
          if (freshUnseen.length > 0) {
            const toShow = freshUnseen.slice(0, MAX_INDIVIDUAL_TOASTS)
            toShow.forEach(n => {
              const target = resolveNotificationTarget(n)
              // A workflow-run row also carries a calm status line (done/pending/
              // failed) + the backend's fixed next-step copy — never a raw unknown status.
              const action = resolveActionLine(n)
              // K-192: next_action is a KEY, not prose — render its copy only for the
              // two known keys (auto_processing/check_followup_task); an unknown or
              // null key shows the status line alone, never a raw key.
              const actionLine = action
                ? `${t(`notifications.actionStatus.${action.status}`)}${action.nextAction ? ` ${t(`notifications.nextAction.${action.nextAction}`)}` : ''}`
                : undefined
              notify('info', n.body || '', {
                title: n.title,
                duration: ATTENTION_TOAST_DURATION,
                onOpen: target ? () => navigateToNotificationTarget(target) : undefined,
                deepLink: target ? buildNotificationDeepLink(target) : undefined,
                actionLine,
              })
            })
            const remaining = freshUnseen.length - toShow.length
            if (remaining > 0) {
              notify('info', t('notifications.moreNew', { count: remaining }), { duration: ATTENTION_TOAST_DURATION })
            }
            if (soundEnabledRef.current) playNotificationChime()
          }
        }
        knownIds.current = nextKnown
      })
      .catch(() => setItems([]))
  }, [t, pollMs])

  // Poll on an interval, skipping ticks while the tab is hidden; clean up on unmount.
  useEffect(() => {
    load()
    const id = setInterval(() => { if (shouldPollNotifications()) load() }, pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  const unseen = items.filter(n => !n.seen).length

  // Mark all seen — optimistic locally, best-effort on the backend.
  const markAllSeen = useCallback(() => {
    setItems(prev => (prev.some(n => !n.seen) ? prev.map(n => ({ ...n, seen: true })) : prev))
    api.post('/notifications/seen').catch(() => {})
  }, [])

  return { items, unseen, markAllSeen, reload: load }
}
