// Teams lookup screen (TEAM-MEMBERS-1): the shared editor plus a members button per row.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import StatusListEditor from '../StatusListEditor'
import type { StatusListItem } from '../statusListEditorTypes'
import TeamMembersModal from './TeamMembersModal'

export default function TeamsSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const [membersFor, setMembersFor] = useState<StatusListItem | null>(null)
  const canManage = auth?.hasPermission('settings.update') ?? false
  return (
    <div style={{ maxWidth: 640 }}>
      {/* reorderable off: /teams has no reorder route, so dragging would never persist. */}
      <StatusListEditor compact withColor reorderable={false} title={t('teams.title')} subtitle={t('teams.subtitle')}
        endpoint="/teams" addLabel={t('teams.add')}
        rowActions={canManage ? (item => (
          <Button variant="ghost" onClick={() => setMembersFor(item)} aria-label={`${t('teams.members')}: ${String(item.name ?? '')}`}>
            <Users size={13} />{t('teams.members')}
          </Button>
        )) : null} />
      {membersFor && <TeamMembersModal team={{ id: membersFor.id, name: membersFor.name }} onClose={() => setMembersFor(null)} />}
    </div>
  )
}
