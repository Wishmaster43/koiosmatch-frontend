import type { TFunction } from 'i18next'
import { Sparkles } from 'lucide-react'
import Button from '@/components/ui/Button'
import GenerateFlowStatus from '@/components/ui/GenerateFlowStatus'
import type { GenerateFlowStatusValue } from '@/components/ui/GenerateFlowStatus'

interface GenerateCtaButtonProps {
  onClick: () => void
  disabled?: boolean
  label: string
}

// GenerateCtaButton — the shared idle-state "Genereer met Koios" entry button
// (ProfileGenerateFlow, GenerateDescriptionFlow, …).
export function GenerateCtaButton({ onClick, disabled, label }: GenerateCtaButtonProps) {
  return (
    <Button variant="primary" size="sm" onClick={onClick} disabled={disabled} style={{ alignSelf: 'flex-start' }}>
      <Sparkles size={13} /> {label}
    </Button>
  )
}

interface GenerateApplyStatusProps {
  status: GenerateFlowStatusValue
  concept: string
  generate: () => void
  onApply: (concept: string) => void
  discard: () => void
  closeFlow: () => void
  t: TFunction
}

/**
 * GenerateApplyStatus — the shared "apply this Koios-generated concept and
 * close the flow" wiring around GenerateFlowStatus (ProfileGenerateFlow,
 * GenerateDescriptionFlow, …): applying always closes the flow right after,
 * so every caller shares this one onApply closure instead of retyping it.
 */
export default function GenerateApplyStatus({ status, concept, generate, onApply, discard, closeFlow, t }: GenerateApplyStatusProps) {
  return (
    <GenerateFlowStatus status={status} concept={concept} onRetry={generate}
      onApply={() => { onApply(concept); closeFlow() }} onDiscard={discard} t={t} />
  )
}
