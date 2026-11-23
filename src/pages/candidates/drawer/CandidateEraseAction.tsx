/**
 * CandidateEraseAction (CANDIDATE-ERASE-FE-1, Danny 23-11 Q6 / ERASURE-OPEN-MATCH-1): the right-to-erasure
 * button of the candidate drawer header plus its password dialog. Mirrors the contact person's "Persoon
 * wissen" (ONIX K-005): a dangerSoft icon button beside the right-of-access export, the shared
 * EraseWithPasswordDialog, and the open-match conflict step that re-posts with close_open_matches.
 * Rendered only with privacy.erase (the drawer gates it; the BE re-checks and asks the password).
 */
import { useTranslation } from 'react-i18next'
import { UserX } from 'lucide-react'
import Button from '@/components/ui/Button'
import EraseWithPasswordDialog from '@/components/drawer/EraseWithPasswordDialog'
import { openMatchConflictMessage, useCandidateErase } from '../hooks/useCandidateErase'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

// Button + dialog pair; the caller decides what follows a successful erase (the drawer closes).
export default function CandidateEraseAction({ c, onErased }: { c: Candidate; onErased: (id: Id) => void | Promise<void> }) {
  const { t } = useTranslation('candidates')
  const erase = useCandidateErase(c.id, t('erase.personErased'), onErased)
  return (
    <>
      <Button variant="dangerSoft" size="sm" iconOnly onClick={erase.open} title={t('erase.erasePerson')} aria-label={t('erase.erasePerson')}>
        <UserX size={13} />
      </Button>
      {erase.erasing && (
        <EraseWithPasswordDialog open title={t('erase.erasePerson')} intro={t('erase.eraseIntro', { name: c.name })}
          confirmLabel={t('erase.erasePerson')} onConfirm={erase.confirm} onClose={erase.cancel}
          conflict={{ detect: err => openMatchConflictMessage(err, t), actionLabel: t('erase.closeMatchesAndErase') }} />
      )}
    </>
  )
}
