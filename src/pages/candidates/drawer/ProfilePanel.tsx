import ProfileTab from './ProfileTab'
import KoiosAiBlock from './KoiosAiBlock'
import BranchSection from './BranchSection'
import PoolsSection from './PoolsSection'
import type { Candidate } from '@/types/candidate'

/** Profile tab — profile fields + AI block + pools + branch.
 * Languages moved to the Background tab; documents to their own tab.
 * Each block owns its edit state. */
export default function ProfilePanel({ c, onEditSave, autoEditSignal }: { c: Candidate; onEditSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ProfileTab c={c} onEditSave={onEditSave} autoEditSignal={autoEditSignal} />
      <KoiosAiBlock c={c} />
      <PoolsSection c={c} />
      <BranchSection c={c} />
    </div>
  )
}
