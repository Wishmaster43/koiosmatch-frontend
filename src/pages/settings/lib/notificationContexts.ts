/**
 * Shared source of truth for which notification contexts have NO real backend
 * emitter yet (NOTIF-PARITY-1). Both the tenant-wide screen (NotificationsSettings)
 * and the per-user override screen (MyNotificationsSettings) must agree on this set,
 * or one screen would render a working-looking control that can never deliver
 * anything (§3 no fake affordance). Verified against api Notifier.php
 * (TYPE_CONTEXT_MAP), every Notifier::send() call site, and the notification_send
 * workflow templates:
 *   sollicitaties -> application.created fires on every application write
 *   kandidaten    -> candidate.reactivated fires from the daily reactivate-due cron
 *   klanten       -> customer.* fires from five daily stagnation/lifecycle commands
 *   matches       -> match.expiring fires from the daily matches:expiring-alerts cron
 *   taken         -> task.due fires from the tasks:notify-due cron
 *   calllists     -> calllist.target_assigned fires on manual/round-robin/workflow
 *                    target assignment (NOTIF-CONTEXTEN-FE-1, CMBE 23-08)
 *   opportunities -> opportunity.won / opportunity.lost fire on every stage change
 *                    into an is_won/is_lost stage (NOTIF-CONTEXTEN-FE-1, CMBE 23-08)
 *   appointments  -> appointment.today fires from the daily appointments-due-today
 *                    cron (BEL-ACTIE-VANDAAG-1, CMBE K-156, 23-08)
 * vacatures (vacancy.*) has NO call site at all. facturering (invoice.*) only ever
 * reaches Notifier::sendToSuperAdmins() (GenerateMonthlyInvoices), which targets
 * super admins outside any tenant context and never consults the tenant's
 * notif_facturering_* gate — so the tenant-facing toggle still cannot deliver
 * anything. Re-verify this set whenever CMBE ships a new emitter (drop the context
 * here once a real tenant-gated call site lands).
 */
export const CONTEXTS_WITHOUT_EMITTER = new Set(['vacatures', 'facturering'])

/** Whether a given notification context has no working backend emitter yet. */
export function hasNoEmitterYet(context: string): boolean {
  return CONTEXTS_WITHOUT_EMITTER.has(context)
}
