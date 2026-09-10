import { describe, it, expect } from 'vitest'
import { matchCardRowProps } from './matchCardRowProps'
import type { MatchRow } from '@/types/match'

// Minimal row fixture — only the fields matchCardRowProps actually reads.
const row = {
  id: 'm-1', vacancyId: 'v-1', vacancy: 'Logistiek medewerker',
  stage: 'open', stageColor: '#aaa', score: 82,
  helloflexLink: null, shiftmanagerLink: null,
  candidateId: 'c-1', candidate: 'Jan Jansen',
  contractType: 'Fulltime', functionTitle: 'Magazijn', branchName: 'Rotterdam', owner: 'Piet',
  startDate: '2026-01-01', endDate: null, archived: false,
} as unknown as MatchRow

describe('matchCardRowProps', () => {
  it('builds the shared MatchCard prop bag, preferring statusMeta over the row fallback', () => {
    const props = matchCardRowProps(row, {
      statusMeta: { label: 'Actief', color: '#0a0', is_closed: false },
      showHelloflex: true, showShiftmanager: false, otherPartyLabel: 'Kandidaat',
    })

    expect(props.id).toBe('m-1')
    expect(props.vacancyTitle).toBe('Logistiek medewerker')
    expect(props.stageLabel).toBe('Actief')
    expect(props.stageColor).toBe('#0a0')
    expect(props.otherParty).toEqual({ page: 'candidates', id: 'c-1', label: 'Jan Jansen' })
    expect(props.otherPartyLabel).toBe('Kandidaat')
    expect(props.showHelloflex).toBe(true)
    expect(props.showShiftmanager).toBe(false)
    expect(props.isClosed).toBe(false)
    expect(props.collapsible).toBe(true)
    expect(props.flatRow).toBe(true)
    expect(props.leadWithOtherParty).toBe(true)
  })

  it('falls back to the row-own stage/vacancy title when statusMeta or the vacancy title is absent', () => {
    const bare = { ...row, vacancy: '' } as unknown as MatchRow
    const props = matchCardRowProps(bare, {
      statusMeta: undefined, showHelloflex: false, showShiftmanager: false, otherPartyLabel: 'Kandidaat',
    })

    expect(props.vacancyTitle).toBe('—')
    expect(props.stageLabel).toBe('open')
    expect(props.stageColor).toBe('#aaa')
    expect(props.isClosed).toBeUndefined()
  })

  it('never sets contractStatus/contractForm/showVacancyColumn — those stay the caller\'s own tail props', () => {
    const props = matchCardRowProps(row, {
      statusMeta: undefined, showHelloflex: false, showShiftmanager: false, otherPartyLabel: 'Kandidaat',
    })

    expect(props).not.toHaveProperty('contractStatus')
    expect(props).not.toHaveProperty('contractForm')
    expect(props).not.toHaveProperty('showVacancyColumn')
  })
})
