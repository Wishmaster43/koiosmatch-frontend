/** NotificationsSettings — per-context (applications / vacancies / billing / candidates /
 * matches / tasks — mirrors api Notifier::TYPE_CONTEXT_MAP) notification preferences,
 * stored as `notif_<context>_in_app` + `notif_<context>_email` (O-27, commit 551c17e1).
 * Both channel keys live in the SAME generic tenant key/value settings store, so the
 * e-mail toggle needed no new backend route — it POSTs through the exact same `/settings`
 * endpoint the in-app toggle already used. Migrated to the settings kit; the scaffold owns
 * the header + dirty-aware save. */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingRow, Toggle } from '../components/SettingsKit'
import SoftChip from '@/components/ui/SoftChip'

// NOTIF-PARITY-1 (2026-08-08) — verified against api Notifier.php (TYPE_CONTEXT_MAP), every
// Notifier::send() call site, and the (default_status=draft, opt-in) notification_send
// workflow templates. A context only counts as "live" once a code path calls Notifier::send()
// with a matching type prefix OUTSIDE an opt-in draft workflow the tenant must still activate:
//   sollicitaties -> application.created fires on every application write (Application model)
//   kandidaten    -> candidate.reactivated fires from the daily candidates:reactivate-due cron
//   matches       -> match.expiring fires from the daily matches:expiring-alerts cron
//   taken         -> task.due fires from the tasks:notify-due cron (task.assigned has no
//                     emitter yet, but the toggle already gates a real event, so it stays live)
// vacatures (vacancy.*) and facturering (invoice.*) have NO call site at all — no Invoice
// entity even exists yet, and no notification_send template targets a vacancy trigger — so
// NEITHER channel toggle can deliver anything regardless of value. Re-verify this set whenever
// CMBE ships a new emitter (drop the context here once a real call site lands).
const CONTEXTS_WITHOUT_EMITTER = new Set(['vacatures', 'facturering'])

export default function NotificationsSettings({ context }) {
  const { t } = useTranslation('settings')
  const inAppKey = `notif_${context}_in_app`
  const emailKey = `notif_${context}_email`
  const noEmitterYet = CONTEXTS_WITHOUT_EMITTER.has(context)

  // O-27 (verified against api app/Support/Notifier.php, commit 551c17e1): in-app defaults
  // ON (absent = on, unchanged), e-mail is OPT-IN and defaults OFF (absent = off) — the FE
  // default mirrors the backend gate exactly so an unsaved screen never misrepresents the
  // live state before the first load resolves.
  const defaults = useMemo(() => ({ [inAppKey]: true, [emailKey]: false }), [inAppKey, emailKey])
  const form = useSettingsForm(defaults)

  // Two channel rows per context, rendered side by side so both are visible at once for
  // this one type. No "mail provider configured" gate exists to key the e-mail copy off
  // (verified: GenericNotification::toMail sends through the app's own default mailer, not
  // any per-tenant OAuth connection — there is no such signal anywhere in the /settings
  // payload) — so the description makes no claim about provider state instead of inventing one.
  const options = [
    { key: inAppKey, label: t('notifications.inApp.label'), desc: t('notifications.inApp.desc') },
    { key: emailKey, label: t('notifications.email.label'), desc: t('notifications.email.desc') },
  ]

  return (
    <SettingsScaffold
      title={t(`notifications.context.${context}.title`, context)}
      subtitle={t(`notifications.context.${context}.desc`, '')}
      maxWidth={640} form={form}>
      {/* Side by side, not stacked: both channels for this one notification type are
          visible at once, each rendered through the exact same Toggle component. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {options.map(opt => (
          <div key={opt.key} style={{ flex: '1 1 260px', minWidth: 240 }}>
            <SettingRow label={opt.label} description={opt.desc}>
              {/* Honest gate (NOTIF-PARITY-1): a context with no real emitter never promises
                  delivery it cannot make, on either channel — a calm muted marker replaces
                  the working-toggle look, and the switch itself is disabled-with-reason. */}
              {noEmitterYet && (
                <SoftChip label={t('notifications.inApp.notYetActive')} color="var(--text-muted)"
                  title={t('notifications.inApp.notYetActiveReason')} />
              )}
              <Toggle checked={!!form.values[opt.key]} onChange={v => form.set(opt.key, v)}
                disabled={noEmitterYet} ariaLabel={opt.label}
                title={noEmitterYet ? t('notifications.inApp.notYetActiveReason') : undefined} />
            </SettingRow>
          </div>
        ))}
      </div>
    </SettingsScaffold>
  )
}
