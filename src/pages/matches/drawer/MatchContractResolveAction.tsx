/**
 * MatchContractResolveAction — CLAIM-RESOLVE-1: beside the match's contract
 * status, while a HelloFlex send is stuck (`contractStatus === 'sending'`)
 * this shows the "sinds …" age and a dangerSoft "Markeer als niet verzonden"
 * button that opens the shared ResolveClaimDialog. On success the match's
 * contractStatus flips to 'failed' locally (via onUpdate), so only THIS
 * action disappears immediately — MatchClientRow's lock caption stays (it
 * locks on any contractStatus !== 'none', and 'failed' still qualifies); the
 * normal send route accepts a new claim from 'failed'.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'
import ResolveClaimDialog from '@/components/drawer/ResolveClaimDialog'
import { formatDateTimeStr } from '@/lib/localDate'
import { notifySuccess } from '@/lib/notify'
import { useResolveContractClaim } from '../hooks/useResolveContractClaim'
import type { MatchRow } from '@/types/match'

interface Props {
  match: MatchRow
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

export default function MatchContractResolveAction({ match, onUpdate }: Props) {
  const { t } = useTranslation('matches')
  const { resolve } = useResolveContractClaim(match.id)
  const [open, setOpen] = useState(false)

  // Hand the dialog's reason to the hook; any failure (404/409/network) propagates
  // up unchanged so the dialog's own error mapping renders it — never swallowed here.
  const handleConfirm = async (reason: string) => {
    const body = await resolve(reason)
    onUpdate?.(match.id, { contractStatus: body?.contract_status ?? 'failed' })
    setOpen(false)
    notifySuccess(t('drawer.contract.resolved'))
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Caption as="span">
          {t('drawer.contract.sendingSince', { since: formatDateTimeStr(match.contractSendingSince) })}
        </Caption>
        <Button variant="dangerSoft" size="sm" onClick={() => setOpen(true)}>
          {t('drawer.contract.resolveNotSent')}
        </Button>
      </div>
      <ResolveClaimDialog open={open} title={t('drawer.contract.resolveNotSent')}
        intro={t('drawer.contract.resolveIntro')} confirmLabel={t('drawer.contract.resolveNotSent')}
        onClose={() => setOpen(false)} persistKey="match-contract-resolve"
        onConfirm={handleConfirm} />
    </>
  )
}
