/**
 * KoiosSuggestionExec — the three notice/preview components of a suggestion
 * row's staged/confirm leg (golf 3). Split out of KoiosSuggestionRow purely
 * for size (§3); behaviour is UNCHANGED by KOIOS-SUGGEST-COMPACT-1. Pure
 * helpers + the `useRun` hook live in `koiosSuggestionRunner` so this file
 * only exports components.
 */
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Caption } from '@/components/ui/typography'
import { KoiosRefChip } from './KoiosResultCards'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import { previewLine, useRun } from './koiosSuggestionRunner'
import { shapePreviewRows } from './pendingPreview'
import type { ExecState } from './koiosSuggestionRunner'
import type { KoiosContextRef } from '@/types/koios'
import type { ActionBudget } from '@/types/actionBudget'

// One error row: the server's message, plus a budget_exceeded upgrade hint when
// present (KOIOS-CONFIRM-DECLINE-1) — never a price, only the upgrade label.
export function ExecErrorNotice({ message, budget, t }: { message?: string; budget?: ActionBudget; t: (key: string, opts?: Record<string, unknown>) => string }) {
  return (
    <span role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Caption style={{ color: 'var(--color-danger-text)' }}>{message}</Caption>
      {budget?.upgrade_hint?.next_tier_label && (
        <Caption>{t('koios.pendingAction.upgradeHint', { tier: budget.upgrade_hint.next_tier_label })}</Caption>
      )}
    </span>
  )
}

// The confirmed verdict: "Gelukt" plus the created record as a deep-link chip.
export function ExecutedNotice({ created, t }: { created?: KoiosContextRef | null; t: (key: string) => string }) {
  return (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Caption style={{ color: 'var(--color-success-text)' }}>✓ {t('koios.pendingAction.confirmed')}</Caption>
      {created && <KoiosRefChip item={created} />}
    </span>
  )
}

// The preview + confirm/cancel of a staged descriptor action. Rows go through
// `shapePreviewRows` (KOIOS-PENDING-CARD-FACE-1) — translated labels, DD-MM-YYYY
// dates, id/UUID rows hidden — so a raw parameter key or an ISO date never
// reaches the screen (RESCHEDULE-EDIT-1, DATUM-1).
export function StagedPreview({ exec, setExec, onDone }: { exec: ExecState; setExec: (s: ExecState) => void; onDone?: () => void }) {
  const { t } = useTranslation('common')
  const st = exec.staged
  const run = useRun(setExec, onDone)
  const shaped = shapePreviewRows(st?.preview ?? [], t)
  return (
    <div style={{ marginLeft: 26, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Caption style={{ display: 'block' }}>{shaped.rows.map(previewLine).join(' · ')}</Caption>
      {shaped.confidence && (
        <Caption>{t('koios.pendingAction.confidence.label')}: {shaped.confidence}</Caption>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button size="sm" onClick={() => st && run(st.id, confirmPendingAction, 'executed', st.title)} disabled={exec.phase === 'submitting'}>
          {exec.phase === 'submitting' ? <Spinner size={12} /> : null} {t('koios.pendingAction.confirm')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => st && run(st.id, cancelPendingAction, 'cancelled')} disabled={exec.phase === 'submitting'}>
          {t('koios.pendingAction.cancel')}
        </Button>
      </div>
    </div>
  )
}
