/**
 * KoiosPendingActionCard — the confirmation card for a proposed Koios write
 * (KOIOS-AGENT-PLAN §6, dormant until the backend attaches `pending_action` to
 * a chat reply — feature-detected by the caller, KoiosPanel). Entity chip
 * (+ owner when the preview carries one) · preview rows (old → new / payload
 * lines) · the shared ActionRuleBanner for the matrix warning · Bevestigen/
 * Annuleren, with a second confirm step for destructive actions · a subtle
 * expiry countdown that auto-expires the card. Confirm/cancel POST to the
 * pending-action endpoints (koiosApi); an expired/already-resolved action
 * (404/410/422) renders an honest "this proposal has expired" state instead of
 * a generic error.
 *
 * KOIOS-AGENT-FE-1 P1-afronding: (1) an integration tool (connection_active ===
 * false, from GET /ai/koios/capabilities via the shared useKoiosToolCapabilities
 * cache) shows an honest "connection needed" notice and disables Confirm — never
 * a silent failure after click; (2) the tool's own consent-fail-closed refusal
 * (ToolExecutor::executePending still returns HTTP 200 "executed" — the tool
 * itself hands back `{ fout }` / `{ gelukt: false, reden }`, measured against
 * VoorstelSollicitatie.php/StartInterview.php) renders as an honest refusal
 * instead of the generic "confirmed" state.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, AlertTriangle } from 'lucide-react'
import { ActionRuleBanner } from '@/components/actionrules'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import { Caption } from '@/components/ui/typography'
import SoftChip from '@/components/ui/SoftChip'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import { entityIconEl } from './koiosEntityIcons'
import { useKoiosToolCapabilities, findToolCapability, KOIOS_CONNECTION_HASH } from './useKoiosToolCapabilities'
import type { KoiosPendingAction, KoiosPreviewRow } from './koiosTypes'

type CardStatus = 'proposed' | 'confirming' | 'submitting' | 'confirmed' | 'cancelled' | 'expired' | 'error' | 'refused' | 'partial'

// A pending-action REST call's error status, when the server rejects it because
// the proposal is gone/already resolved (never a generic error in that case).
const isExpiredStatus = (status?: number) => status === 404 || status === 410 || status === 422

// Best-effort: surface an "owner" preview row next to the entity chip, if present
// (KOIOS-AGENT-PLAN §7 Job 2 — "naam + eigenaar wanneer aanwezig in preview").
function findOwner(preview: KoiosPreviewRow[]): string | null {
  const row = preview.find((r) => /eigenaar|owner/i.test(r.label))
  return row ? (row.after ?? row.text ?? row.before ?? null) : null
}

// Remaining seconds until `expiresAt` (never negative).
function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

// One preview row: "label · before → after" or "label: text".
function PreviewRow({ row }: { row: KoiosPreviewRow }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{row.label}</span>
      {row.before != null || row.after != null ? (
        <span style={{ color: 'var(--text)' }}>{row.before ?? '—'} → {row.after ?? '—'}</span>
      ) : (
        <span style={{ color: 'var(--text)' }}>{row.text}</span>
      )}
    </div>
  )
}

// One assist-panel card for a Koios-proposed action: countdown, confirm/cancel,
// and (for a destructive action) a required second confirm step before submitting.
export default function KoiosPendingActionCard({ action }: { action: KoiosPendingAction }) {
  const { t } = useTranslation(['common', 'koios'])
  const [status, setStatus] = useState<CardStatus>('proposed')
  const [remaining, setRemaining] = useState(() => secondsLeft(action.expires_at))
  const [refusedReason, setRefusedReason] = useState<string | null>(null)

  // The tool's connection gate (KOIOS-AGENT-FE-1 rule 1): an integration tool with
  // an inactive connection is never offered as a silent-failing confirm.
  const { tools: capabilityTools, isLoading: capsLoading, isError: capsError } = useKoiosToolCapabilities()
  const toolCapability = findToolCapability(capabilityTools, action.tool)
  const connectionInactive = toolCapability?.connection_active === false
  // Gate interim states (never silently open OR silently bricked): loading holds
  // the confirm with a visible reason; a failed check keeps confirm usable — the
  // server's own RequiresActiveConnection gate re-checks — but says so honestly.
  const gateChecking = capsLoading && !!action.tool
  const connectionHash = toolCapability?.connection ? KOIOS_CONNECTION_HASH[toolCapability.connection] : undefined

  // Tick the expiry countdown every second; auto-expire once it hits zero.
  useEffect(() => {
    if (status !== 'proposed' && status !== 'confirming') return
    const id = setInterval(() => {
      const left = secondsLeft(action.expires_at)
      setRemaining(left)
      if (left <= 0) setStatus('expired')
    }, 1000)
    return () => clearInterval(id)
  }, [status, action.expires_at])

  // Confirms the action; a destructive one requires an extra click (the "confirming"
  // step above) before it actually submits to the server.
  const confirm = () => {
    if (connectionInactive) return
    if (action.destructive && status !== 'confirming') { setStatus('confirming'); return }
    setStatus('submitting')
    confirmPendingAction(action.id)
      .then((res: unknown) => {
        // ToolExecutor::executePending still answers HTTP 200 "executed" when the
        // tool itself refuses (consent fail-closed, not-found, …) — the refusal
        // rides in `data.fout` / `data.reden` (VoorstelSollicitatie/StartInterview
        // shape), never a 4xx. Surface it honestly instead of a false "confirmed".
        // REFUSAL-CONVENTION-1 (gap-map, definitive): `gelukt` is the ONLY
        // discriminator; `onthouden[]` marks a PARTIAL execution (deliberately
        // skipped sub-actions); `reden` is the translated carrier — the slug is
        // always present on refusal AND on every withholding; `fout` is only the
        // human fallback (and the path for the ~67 not-yet-normalised tools).
        const data = (res as { data?: { fout?: string; gelukt?: boolean; reden?: string; onthouden?: string[] } })?.data
        const translateReason = (reden?: string, fout?: string) => {
          if (!reden) return fout ?? null
          const slugKey = `koios.pendingAction.reasons.${reden}`
          const translated = t(slugKey)
          return translated === slugKey ? (fout ?? reden) : translated
        }
        if (data?.gelukt === false || (!('gelukt' in (data ?? {})) && (data?.reden || data?.fout))) {
          setRefusedReason(translateReason(data?.reden, data?.fout))
          setStatus('refused')
          return
        }
        if (data?.onthouden?.length || data?.reden) {
          setRefusedReason(translateReason(data?.reden, data?.fout))
          setStatus('partial')
          return
        }
        setStatus('confirmed')
      })
      .catch((e) => setStatus(isExpiredStatus(e?.response?.status) ? 'expired' : 'error'))
  }

  // The secondary button either steps BACK out of the destructive 2nd-step
  // confirm (no API call — nothing was submitted yet) or actually cancels the
  // proposal server-side.
  const cancel = () => {
    if (status === 'confirming') { setStatus('proposed'); return }
    setStatus('submitting')
    cancelPendingAction(action.id)
      .then(() => setStatus('cancelled'))
      .catch((e) => setStatus(isExpiredStatus(e?.response?.status) ? 'expired' : 'error'))
  }

  const owner = findOwner(action.preview) ?? action.entity_ref.owner

  return (
    <div data-testid="koios-pending-action" data-status={status}
      style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'var(--surface)',
        border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{action.title}</div>

      {/* Entity chip + owner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}>
          {entityIconEl(action.entity_ref.type, { size: 12 })}
        </span>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{action.entity_ref.label}</span>
        {owner && <span style={{ color: 'var(--text-muted)' }}>· {t('koios.pendingAction.owner', { name: owner })}</span>}
      </div>

      {/* Preview / diff rows */}
      {action.preview.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          {action.preview.map((row, i) => <PreviewRow key={i} row={row} />)}
        </div>
      )}

      {action.warning && (
        <ActionRuleBanner decision={{ effect: 'warn', popup_code: action.warning.popup_code, message: action.warning.message }} />
      )}

      {/* Integration connection gate — the tool exists but its connection is inactive. */}
      {connectionInactive && (
        connectionHash
          ? <a href={connectionHash} className="no-underline" aria-label={t('capabilities.connectionNeeded', { ns: 'koios' })}>
              <SoftChip label={t('capabilities.connectionNeeded', { ns: 'koios' })} color="var(--color-warning)" />
            </a>
          : <SoftChip label={t('capabilities.connectionNeeded', { ns: 'koios' })} color="var(--color-warning)"
              title={t('capabilities.connectionSectionMissing', { ns: 'koios' })} />
      )}

      {status === 'partial' && (
        <CalloutBox variant="warning" title={t('koios.pendingAction.partialTitle')}>{refusedReason}</CalloutBox>
      )}
      {status === 'refused' && (
        <CalloutBox variant="warning" title={t('koios.pendingAction.refusedTitle')}>{refusedReason}</CalloutBox>
      )}

      {/* Terminal states */}
      {status === 'confirmed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-success-text)' }}>
          <Check size={14} /> {t('koios.pendingAction.confirmed')}
        </div>
      )}
      {status === 'cancelled' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('koios.pendingAction.cancelled')}</div>
      )}
      {status === 'expired' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-warning-text)' }}>
          <AlertTriangle size={14} /> {t('koios.pendingAction.expired')}
        </div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('koios.pendingAction.error')}</div>
      )}

      {/* Actions — hidden once resolved (confirmed/cancelled/expired/error are terminal) */}
      {(status === 'proposed' || status === 'confirming' || status === 'submitting') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {/* Destructive 2nd-step confirm switches to the danger variant; otherwise primary. */}
          <Button variant={action.destructive && status === 'confirming' ? 'danger' : 'primary'}
            size="sm" onClick={confirm} disabled={status === 'submitting' || connectionInactive || gateChecking}
            aria-describedby={connectionInactive || gateChecking ? 'koios-action-gate-reason' : undefined}>
            {status === 'confirming' ? t('koios.pendingAction.confirmFinal') : t('koios.pendingAction.confirm')}
          </Button>
          <Button variant="secondary" size="sm" onClick={cancel} disabled={status === 'submitting'}>
            {status === 'confirming' ? t('koios.pendingAction.back') : t('koios.pendingAction.cancel')}
          </Button>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
            {t('koios.pendingAction.expiresIn', { seconds: remaining })}
          </span>
        </div>
      )}
      {/* The gate's reason, in the accessible tree (a disabled button's title is
          not reliably announced) — §3 disabled-with-honest-notice. */}
      {(connectionInactive || gateChecking || capsError) && (status === 'proposed' || status === 'confirming') && (
        <Caption as="p" id="koios-action-gate-reason">
          {connectionInactive ? t('koios.pendingAction.confirmDisabledConnection')
            : gateChecking ? t('koios.pendingAction.connectionCheckLoading')
            : t('koios.pendingAction.connectionCheckUnknown')}
        </Caption>
      )}
    </div>
  )
}
