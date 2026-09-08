/**
 * PopoutErrorShell — shared error state for popout pages (notes, text).
 * Wraps PopoutShell in error mode (no loading), simplifying per-page error
 * handling in NotesPopoutPage and TextPopoutPage by consolidating the
 * `loading={false} error onRetry={...}` boilerplate.
 */
import { useTranslation } from 'react-i18next'
import { PopoutShell } from '@/pages/popout/shared'

interface PopoutErrorShellProps {
  // User-facing error message from the host's t() call (e.g. t('popout.unknownEntity')).
  label: string
  // Callback on retry button click (typically window.location.reload()).
  onRetry: () => void
}

// Render PopoutShell's error state with the given message and retry action.
export default function PopoutErrorShell({ label, onRetry }: PopoutErrorShellProps) {
  const { t } = useTranslation('common')

  return (
    <PopoutShell
      loading={false}
      error
      onRetry={onRetry}
      loadingLabel=""
      errorLabel={label}
      retryLabel={t('error.retry')}
      name=""
      initials=""
      subtitle=""
    >
      {null}
    </PopoutShell>
  )
}
