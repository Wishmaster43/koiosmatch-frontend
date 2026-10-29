/**
 * MatchContractSendAction — HF-CONTRACT-SEND-1: the "send contract to HelloFlex"
 * button beside the match's contract status. Visible only with matches.update AND
 * the HelloFlex app (id 'hf') enabled, and only while the contract status is none/failed and no
 * HelloFlex contract exists (the resolve action owns the stuck case).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { CANON_LABEL_WIDTH } from '@/components/drawer/fieldRowCanon'
import { useApps } from '@/context/AppsContext'
import MatchContractSendModal from './MatchContractSendModal'
import type { MatchRow } from '@/types/match'

interface Props {
  match: MatchRow
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

export default function MatchContractSendAction({ match, onUpdate }: Props) {
  const { t } = useTranslation('matches')
  const auth = useAuth()
  const apps = useApps()
  const [open, setOpen] = useState(false)

  const allowed = !!auth?.hasPermission?.('matches.update') && !!apps?.isAppEnabled('hf')
  // Complementary to the resolve action (only on 'sending'): sendable from none/failed, with no GUID yet.
  const sendable = (!match.contractStatus || ['none', 'failed'].includes(match.contractStatus)) && !match.helloflexContractGuid
  if (!allowed || !sendable || match.archived) return null

  return (
    <div style={{ paddingLeft: CANON_LABEL_WIDTH + 12, marginTop: 4 }}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{t('drawer.contractSend.open')}</Button>
      {open && <MatchContractSendModal match={match} onClose={() => setOpen(false)} onUpdate={onUpdate} />}
    </div>
  )
}
