// Regression test for totalsTableStyle (SHARED-UNIT-TEST-1): the dense flag must
// change padding only, never the rest of the shared recipe.
import { describe, it, expect } from 'vitest'
import { totalsTableHeaderStyle, totalsTableCellStyle } from './totalsTableStyle'

describe('totalsTableStyle', () => {
  it('regular header/cell use the wider padding', () => {
    expect(totalsTableHeaderStyle().padding).toBe('6px 10px')
    expect(totalsTableCellStyle().padding).toBe('6px 10px')
  })

  it('dense header/cell use the tighter padding, everything else unchanged', () => {
    const regularHeader = totalsTableHeaderStyle()
    const denseHeader = totalsTableHeaderStyle(true)
    expect(denseHeader.padding).toBe('5px 8px')
    expect({ ...denseHeader, padding: regularHeader.padding }).toEqual(regularHeader)

    const regularCell = totalsTableCellStyle()
    const denseCell = totalsTableCellStyle(true)
    expect(denseCell.padding).toBe('5px 8px')
    expect({ ...denseCell, padding: regularCell.padding }).toEqual(regularCell)
  })

  it('body cells always keep tabular-nums for aligned numeric columns', () => {
    expect(totalsTableCellStyle().fontVariantNumeric).toBe('tabular-nums')
    expect(totalsTableCellStyle(true).fontVariantNumeric).toBe('tabular-nums')
  })

  it('header style carries layout only, never a font identity (callers bring their own)', () => {
    expect(totalsTableHeaderStyle()).not.toHaveProperty('fontSize')
    expect(totalsTableHeaderStyle()).not.toHaveProperty('color')
  })
})
