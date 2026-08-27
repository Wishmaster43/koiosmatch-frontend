/**
 * useOutreachTargets — row-selection/expand UI state and the inline direct-match
 * mutation (POST /matches) for TargetsTab, extracted verbatim (pure split, no
 * behaviour change) so the tab component stays presentational.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { OutreachTarget } from './useOutreachDetail'

export function useOutreachTargets() {
  const { t } = useTranslation('outreach')
  // G29 — row selection feeding AssignTargetsBar; cleared once an assign settles.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleRow = (id: string) => setSelected(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  // BELLIJST-SCALE-1 — rows expanded to show outcome/note; collapsed by default
  // so a 400-row list stays a scannable list, not 400 open cards.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpanded = (id: string) => setExpanded(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  // Per-row follow-up state: which target has the match prompt open.
  const [matchFor, setMatchFor] = useState<OutreachTarget | null>(null)
  const [matchVacancyId, setMatchVacancyId] = useState('')
  const [matchSaving, setMatchSaving] = useState(false)

  // Create the match via the canonical direct-match endpoint (G-2, mirrors useCreateMatch).
  const confirmMatch = async () => {
    if (!matchFor?.candidate?.id || !matchVacancyId) return
    setMatchSaving(true)
    try {
      await api.post('/matches', { candidate_id: matchFor.candidate.id, vacancy_id: matchVacancyId })
      notifySuccess(t('drawer.matchCreated'))
      setMatchFor(null); setMatchVacancyId('')
    } catch {
      notifyError(t('drawer.matchFailed'))
    } finally { setMatchSaving(false) }
  }

  return {
    selected, setSelected, toggleRow,
    expanded, toggleExpanded,
    matchFor, setMatchFor, matchVacancyId, setMatchVacancyId, matchSaving, confirmMatch,
  }
}
