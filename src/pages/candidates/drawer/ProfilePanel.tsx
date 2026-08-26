/** Profile tab — profile fields + AI block + branch.
 * Languages moved to the Background tab; documents to their own tab; talent
 * pools moved to the Match tab's own Talentenpools ("Talent pools") sub-tab
 * (Danny, candidates-round-2, point C — same PoolsSection component, new
 * home). Each block owns its edit state. */
import ProfileTab from './ProfileTab'
import KoiosAiBlock from './KoiosAiBlock'
import BranchSection from './BranchSection'
import type { Candidate } from '@/types/candidate'

// Composes the profile tab's three fixed blocks (fields, Koios AI, branch); each block owns its own edit state (see file header).
export default function ProfilePanel({ c, onEditSave, autoEditSignal, onContactMoment }: {
  c: Candidate; onEditSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number
  // B15-flow: a confirmed contact moment updates local state ONLY (the write
  // already happened via its own endpoint) — never re-routed through onEditSave,
  // which would fire a redundant/incorrect candidate PATCH.
  onContactMoment?: (v: Record<string, unknown>) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ProfileTab c={c} onEditSave={onEditSave} autoEditSignal={autoEditSignal} onContactMoment={onContactMoment} />
      <KoiosAiBlock c={c} />
      <BranchSection c={c} />
    </div>
  )
}
