/**
 * MyNotificationsSettings (G28) — the CALLER's OWN per-context in-app
 * notification override, sitting NEXT TO the tenant-wide switch
 * (NotificationsSettings.jsx, which writes `notif_<context>_in_app` +, since
 * O-27, `notif_<context>_email`). Reads/writes `GET/PUT /settings/my-notifications
 * { contexts: { <context>: true|false|null } }` (verified against
 * app/Http/Controllers/MyNotificationSettingsController.php +
 * app/Support/Notifier.php::contexts()): `null` = inherit the tenant-wide
 * default (ON when the tenant never configured it), `true`/`false` forces
 * this context on/off for the caller only, regardless of the tenant switch.
 * The context list AND its labels are the exact six the tenant screen
 * already ships (`notifications.context.*`) — this screen derives the row
 * set from whatever the API returns rather than hardcoding it, so no new
 * per-context copy is needed and a future context needs no FE change here.
 *
 * E-mail column (O-27, commit 551c17e1) — HONEST GATE, not a working control:
 * `Notifier::send()` DOES resolve a per-user e-mail override from a
 * `notif_<context>_email.user.<uuid>` setting key (Notifier.php::userOverridesFor
 * with channel='email'), but `MyNotificationSettingsController` was never updated
 * to write it — `index()`/`update()` both call `Notifier::userKey($context, $uid)`
 * with NO channel argument, which always resolves to the `_in_app.user.<uuid>` key
 * (the method's default). There is today no request shape this endpoint accepts
 * that targets the e-mail key, so a working per-user e-mail toggle here would
 * either 422 on an unexpected field or — worse — silently flip the caller's IN-APP
 * override while the UI claims it changed e-mail. Verified against the live
 * controller source (no later commit touches it); until CMBE adds a `channel`
 * param (mirroring `Notifier::userKey`'s own signature), this column renders a
 * calm muted marker instead of a SegmentedControl (§3 no fake affordance) — the
 * caller always follows the tenant-wide e-mail switch for now.
 *
 * NOTIF-PARITY-1: a context with no working backend emitter (see
 * `../lib/notificationContexts`, shared with NotificationsSettings.jsx) renders the
 * same muted "not active yet" marker in the in-app column too — a per-user override
 * on a context nothing ever calls Notifier::send() for would be exactly as fake as
 * the tenant-wide toggle would be.
 *
 * Each row saves OPTIMISTICALLY on change (its own partial PUT), with
 * rollback + toast on failure — mirrors useMyKoiosMode, the sibling
 * per-user "my-*" preference screen on the same controller family — so
 * there is no separate batch Save button here.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserPreference } from '@/hooks/useUserPreference'
import { AlertTriangle } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import SegmentedControl from '@/components/ui/SegmentedControl'
import SoftChip from '@/components/ui/SoftChip'
import Toggle from '@/components/ui/Toggle'
import { isSupported as isPushSupported, permissionState, isSubscribed, subscribe, unsubscribe } from '@/lib/pushSubscription'
import { SettingCardList, SettingRow, SkeletonRows } from '../components/SettingsKit'
import { hasNoEmitterYet } from '../lib/notificationContexts'
import { PageTitle } from '@/components/ui/typography'

// The API's tri-state per context: null = inherit the tenant default, true/false
// = an explicit personal override. A distinct type from plain boolean so a caller
// can never accidentally treat "no override" as "off".
type ContextValue = boolean | null
type ContextMap = Record<string, ContextValue>

/** Load + optimistically persist the caller's own per-context overrides. */
function useMyNotifications() {
  const { t } = useTranslation('settings')
  const [contexts, setContexts] = useState<ContextMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load once on mount; the alive guard drops a stale response after unmount (§9).
  useEffect(() => {
    let alive = true
    api.get('/settings/my-notifications')
      .then(res => {
        if (!alive) return
        const body = unwrap<{ contexts?: ContextMap }>(res)
        setContexts(body?.contexts ?? {})
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Persist ONE context optimistically; a failed PUT rolls that row back and
  // toasts, so a dropped save never leaves the UI silently wrong.
  const setContext = (context: string, value: ContextValue) => {
    const prev = contexts[context] ?? null
    setContexts(c => ({ ...c, [context]: value }))
    api.put('/settings/my-notifications', { contexts: { [context]: value } }).catch(() => {
      setContexts(c => ({ ...c, [context]: prev }))
      notifyError(t('notifications.my.saveFailed'))
    })
  }

  return { contexts, loading, error, setContext }
}

/** Load + toggle the browser-push subscription (P11-FASE5). Subscribing IS the
 * server-side opt-in — there is no separate setting key to persist here. */
function useBrowserPush() {
  const { t } = useTranslation('settings')
  const supported = isPushSupported()
  const permission = permissionState()
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  // Reflect the browser's actual subscription state on mount (no server flag needed).
  useEffect(() => {
    let alive = true
    if (!supported) return
    isSubscribed().then(v => { if (alive) setSubscribed(v) })
    return () => { alive = false }
  }, [supported])

  // Optimistically flip the browser push subscription, reverting on failure.
  const toggle = async (next: boolean) => {
    setBusy(true)
    const prev = subscribed
    setSubscribed(next)
    try {
      if (next) await subscribe()
      else await unsubscribe()
    } catch {
      setSubscribed(prev)
      notifyError(t(next ? 'notifications.push.subscribeFailed' : 'notifications.push.unsubscribeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return { supported, permission, subscribed, busy, toggle }
}

// Tri-state UI value <-> API value mapping, shared by every row.
const toUi = (v: ContextValue): string => (v === null ? 'inherit' : v ? 'on' : 'off')
const fromUi = (v: string): ContextValue => (v === 'inherit' ? null : v === 'on')

// Small column caption above each channel control — reused for BOTH the working
// in-app SegmentedControl and the honest e-mail marker so the two columns read
// as one pair, not two unrelated widgets.
const captionStyle: CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center',
}

/** The chime is a PERSONAL choice: it lives in the logged-in user's own
 * ui_preferences (PUT /auth/me, the documented mechanism for exactly this) —
 * NEVER the tenant-wide settings blob, where one recruiter muting the sound
 * would silence every colleague and a non-settings.update user would get a
 * silently-swallowed 403 (Opus wave-B1 BLOCKER). Default ON. */
function useSoundSetting() {
  const [enabled, setEnabled] = useUserPreference<boolean>('notif_sound_enabled', true)
  return { enabled, toggle: setEnabled }
}

// Per-user notification preferences: per-context in-app/email toggles, browser push subscription and the sound setting.
export default function MyNotificationsSettings() {
  const { t } = useTranslation('settings')
  const { contexts, loading, error, setContext } = useMyNotifications()
  const push = useBrowserPush()
  const sound = useSoundSetting()
  const known = Object.keys(contexts)

  // Inherit clears the override (null), On/Off force the context for the
  // caller only — same three options on every row.
  const options = [
    { value: 'inherit', label: t('notifications.my.inherit') },
    { value: 'on', label: t('notifications.my.on') },
    { value: 'off', label: t('notifications.my.off') },
  ]

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 20 }}>
        <PageTitle>{t('notifications.my.title')}</PageTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('notifications.my.subtitle')}</p>
      </div>

      {/* Browser-push toggle (P11-FASE5). Unsupported browser or a denied OS/browser
          permission renders an honest disabled row (§3 — no fake affordance) instead
          of a working control. Subscribing is the opt-in itself: no extra setting key. */}
      <SettingCardList>
        <SettingRow label={t('notifications.push.title')}
          description={
            !push.supported ? t('notifications.push.unsupported')
            : push.permission === 'denied' ? t('notifications.push.blocked')
            : t('notifications.push.desc')
          }>
          <Toggle checked={push.subscribed} onChange={push.toggle}
            disabled={!push.supported || push.permission === 'denied' || push.busy}
            ariaLabel={t('notifications.push.title')} />
        </SettingRow>
        {/* NOTIF-ATTENTION-V1: whether the new-notification attention toast also
            plays a soft chime. Default ON — a per-user ui_preferences choice. */}
        <SettingRow label={t('notifications.sound.title')} description={t('notifications.sound.desc')}>
          <Toggle checked={sound.enabled} onChange={sound.toggle} ariaLabel={t('notifications.sound.title')} />
        </SettingRow>
      </SettingCardList>

      <div style={{ height: 20 }} />

      {/* Four explicit UI states: loading skeleton, load error, empty (no known
          contexts), and the real row list. */}
      {loading ? <SkeletonRows /> : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--color-danger-text)', fontSize: 13 }}>
          <AlertTriangle size={14} /> {t('common.loadError')}
        </div>
      ) : known.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>{t('notifications.my.empty')}</p>
      ) : (
        <SettingCardList>
          {known.map(context => {
            const title = t(`notifications.context.${context}.title`, context)
            // NOTIF-PARITY-1: a per-user override is exactly as fake as the tenant-wide
            // toggle when the context has no working backend emitter yet — never render a
            // working SegmentedControl that changes nothing (§3 no fake affordance).
            const noEmitterYet = hasNoEmitterYet(context)
            return (
              <SettingRow key={context} label={title} description={t(`notifications.context.${context}.desc`, '')}>
                {/* Two columns, side by side: a real working in-app override next to
                    the (currently honest, non-functional) e-mail marker — see the
                    O-27 note at the top of this file for why e-mail isn't a control yet. */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={captionStyle}>{t('notifications.inApp.label')}</span>
                    {noEmitterYet ? (
                      <SoftChip label={t('notifications.inApp.notYetActive')} color="var(--text-muted)"
                        title={t('notifications.inApp.notYetActiveReason')} />
                    ) : (
                      <SegmentedControl size="compact" ariaLabel={title}
                        value={toUi(contexts[context])}
                        onChange={next => setContext(context, fromUi(next))}
                        options={options} />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={captionStyle}>{t('notifications.email.label')}</span>
                    <SoftChip label={t('notifications.my.emailNotAvailable')} color="var(--text-muted)"
                      title={t('notifications.my.emailNotAvailableReason')} />
                  </div>
                </div>
              </SettingRow>
            )
          })}
        </SettingCardList>
      )}
    </div>
  )
}
