import { useState } from 'react'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { extractFormErrorsWithMessages } from '@/lib/extractFormErrors'

interface UseReasonSubmitOptions {
  /** Whether the form is currently valid/ready to submit — guards the submit call. */
  canSubmit: boolean
  /** The mutation itself (already carries its exact contract body). Its resolved
      value is ignored — both callers' hooks resolve their own mapped row, which
      this flow never needs (the caller's onUpdate already ran inside them). */
  action: () => Promise<unknown>
  /** Translated success toast text. */
  successMessage: string
  /** Translated fallback error toast text (used when the 422 carries no field errors). */
  errorMessage: string
  /** Called after a successful submit (closes the modal). */
  onClose: () => void
}

/**
 * useReasonSubmit — the shared submit flow for the match "reason" modals
 * (Renew/Terminate): guard on canSubmit, clear field errors, run the mutation.
 * On a 422 whose response carries an `errors` key (even an EMPTY object — HEAD's
 * `if (body?.errors)` branch), sets per-field errors and keeps the modal open with
 * no toast; otherwise shows a generic toast. On success: notify + close, so the
 * caller's onUpdate (already fired inside the mutation hook) is the single
 * refresh path (clone: RenewMatchModal + TerminateMatchModal submit blocks).
 */
export function useReasonSubmit({ canSubmit, action, successMessage, errorMessage, onClose }: UseReasonSubmitOptions) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const submit = async () => {
    if (!canSubmit) return
    setFieldErrors({})
    try {
      await action()
      notifySuccess(successMessage)
      onClose()
    } catch (err) {
      // null only when the 422 carries no errors key at all (HEAD's `if (body?.errors)`);
      // an empty errors object stays {} so the modal clears its field errors and shows no toast.
      const errors = extractFormErrorsWithMessages(err, {})?.messages ?? null
      if (errors) {
        setFieldErrors(errors)
      } else {
        notifyError(extractApiError(err, errorMessage))
      }
    }
  }

  return { submit, fieldErrors }
}
