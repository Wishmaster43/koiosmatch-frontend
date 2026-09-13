import { MoreHorizontal, RefreshCw, Power, Trash2 } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'

interface CredentialActionMenuProps {
  // Overflow-trigger label + the three action labels, already translated by the caller
  // (ApiKeyDetail / WebhookDetail each read them from their own i18n namespace).
  actionLabel: string
  regenerateLabel: string
  activateLabel: string
  deactivateLabel: string
  deleteLabel: string
  status?: string | null
  onRegenerate: () => void
  onToggleStatus: () => void
  onDelete: () => void
}

// The regenerate/activate-or-deactivate/delete overflow menu shared by every credential
// detail screen (API key, outgoing webhook subscription) — same three actions, same order.
export function CredentialActionMenu({
  actionLabel, regenerateLabel, activateLabel, deactivateLabel, deleteLabel,
  status, onRegenerate, onToggleStatus, onDelete,
}: CredentialActionMenuProps) {
  return (
    <ActionMenu
      label={actionLabel}
      icon={MoreHorizontal}
      align="right"
      menuWidth={220}
      items={[
        { key: 'regenerate', label: regenerateLabel, icon: RefreshCw, onSelect: onRegenerate },
        { key: 'toggle', label: (status ?? 'active') === 'active' ? deactivateLabel : activateLabel, icon: Power, onSelect: onToggleStatus },
        { key: 'delete', label: deleteLabel, icon: Trash2, danger: true, onSelect: onDelete },
      ]}
    />
  )
}
