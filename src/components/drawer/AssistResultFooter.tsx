/**
 * AssistResultFooter — two small pieces shared between ConversationAssistSection's
 * and NoteAssistSection's result blocks: the "Verwerpen" discard button (nested
 * inside each caller's own result box, next to its own Apply button — which
 * differs per caller and stays local) and the KOIOS-FEEDBACK-FE-1 feedback slot
 * (a sibling block below the result box, shown once the answer carries a
 * promptLogId — the server logs every assist answer, thumbs tie back to exactly
 * this one). Two exports rather than one Fragment-returning component: in both
 * callers the discard button and the feedback slot sit at DIFFERENT DOM depths
 * (nested vs. sibling-after), so a single call site would relocate one of them
 * and break the frozen DOM (rule F) — each caller still renders its own
 * `status === 'success' && …` gates exactly as before.
 */
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import KoiosFeedback from '@/components/layout/koios/KoiosFeedback'
import type { TFn } from '@/types/koios'
import type { ComponentProps } from 'react'

// The "Verwerpen" discard button — identical shape in both assist result boxes.
export function AssistDiscardButton({ onDiscard, label }: { onDiscard: () => void; label: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={onDiscard}><X size={13} /> {label}</Button>
  )
}

// KOIOS-FEEDBACK-FE-1, second surface: the caller mounts this only once its own
// `status === 'success'` gate is true (see file header) — this component stays a
// dumb wrapper so it never duplicates that status check.
export function AssistFeedbackSlot({ promptLogId, surface, t }: {
  promptLogId?: string
  // KoiosFeedback's own surface union — read off the component, never copied.
  surface: ComponentProps<typeof KoiosFeedback>['surface']
  t: TFn
}) {
  return (
    <div style={{ marginTop: 6 }}>
      <KoiosFeedback promptLogId={promptLogId} surface={surface} t={t} />
    </div>
  )
}
