import { useTranslation } from 'react-i18next'
import { MATCH_COL_STATUS, MATCH_COL_OTHER_PARTY, MATCH_COL_SCORE, MATCH_COL_ACTIONS } from './matchRowColumns'

/**
 * MatchListHeaderBar — the ONE column-header bar above a flat MatchCard list
 * (KLANTEN 4, Danny 21-08 "Weergeven zoals bij de kandidaat"): promoted from
 * candidates/drawer/MatchesTab.tsx so the customer and vacancy Matches tabs
 * render the identical bar instead of growing drifting copies (§11 — the
 * helper lands WITH adoption on the existing copy site). Column geometry comes
 * from matchRowColumns.ts, the same source MatchCard's own cells read — never
 * two loose numbers. Column order: Vacature · Status · other party · Match
 * (score) · actions (empty header — pure click-icons + chevron only). The one
 * per-entity difference is the other-party label (Klant on the candidate side,
 * Kandidaat on the customer/vacancy side), passed in already translated (§5).
 */
export default function MatchListHeaderBar({ otherPartyLabel }: { otherPartyLabel: string }) {
  const { t } = useTranslation(['candidates', 'matches'])
  return (
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- table-header BAR: the 11/600 muted typography inherits into its column cells; a text atom cannot be this flex container
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8,
      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
      {/* minWidth:0 lets this shrink, so it MUST clip — without overflow the
          label paints straight over the next column when space runs short
          (Danny 09-08 saw "VacatuStatus" printed on top of each other). */}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('candidates:work.vacancy')}</span>
      {/* Reuses the SAME key ApplicationRow's own status column uses (WorkTab.tsx). */}
      <span data-testid="match-col-status-header" style={MATCH_COL_STATUS}>{t('candidates:work.colStatus')}</span>
      <span data-testid="match-col-client-header" style={MATCH_COL_OTHER_PARTY}>{otherPartyLabel}</span>
      {/* Reuses MatchesTable's own score-column label ("Match") rather than a new key. */}
      <span data-testid="match-col-score-header" style={MATCH_COL_SCORE}>{t('matches:cols.score')}</span>
      <span aria-hidden="true" data-testid="match-col-actions-header" style={MATCH_COL_ACTIONS} />
    </div>
  )
}
