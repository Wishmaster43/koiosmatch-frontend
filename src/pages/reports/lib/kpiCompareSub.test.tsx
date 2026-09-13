/**
 * totalCompareSubFor — the shared `subFor` for a report's headline compare card.
 */
import { describe, it, expect } from 'vitest'
import { totalCompareSubFor } from './kpiCompareSub'
import type { CompareMetric } from '../useReportCompare'

const metric = { deltaPct: 12 } as unknown as CompareMetric

describe('totalCompareSubFor', () => {
  it('renders the compare metric for the default "total" key when a compare is present', () => {
    const sub = totalCompareSubFor(metric)
    expect(sub('total')).toBeTruthy()
    expect(sub('other')).toBeUndefined()
  })

  it('renders undefined for every key when there is no compare', () => {
    const sub = totalCompareSubFor(undefined)
    expect(sub('total')).toBeUndefined()
  })

  it('honours a custom totalKey (outreach keys its headline card "total_targets")', () => {
    const sub = totalCompareSubFor(metric, 'total_targets')
    expect(sub('total_targets')).toBeTruthy()
    expect(sub('total')).toBeUndefined()
  })
})
