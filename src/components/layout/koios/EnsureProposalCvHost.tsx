/**
 * EnsureProposalCvHost — renders nothing; hands the shared ensureProposalCv function to the pending-action card.
 * Lazy-loaded by the card so the CV/settings dependency graph stays out of the entry bundle (entryGraph guard).
 */
import { useEffect } from 'react'
import { useEnsureProposalCv } from '@/components/ui/richtext/useEnsureProposalCv'

export type EnsureProposalCv = (applicationId: string) => Promise<string>

// Publishes the hook's function to the parent once, and withdraws it on unmount.
export default function EnsureProposalCvHost({ onReady }: { onReady: (fn: EnsureProposalCv | null) => void }) {
  const { ensureProposalCv } = useEnsureProposalCv()
  useEffect(() => {
    onReady(ensureProposalCv)
    return () => onReady(null)
  }, [ensureProposalCv, onReady])
  return null
}
