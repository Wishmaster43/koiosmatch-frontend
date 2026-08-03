/**
 * csv.test.ts — proves the parser/serializer mirror CsvFile.php's own rules
 * (delimiter sniff, header normalisation, BOM strip, quoted fields) and that a
 * non-UTF-8 file is never silently mangled.
 */
import { describe, it, expect } from 'vitest'
import { buildCsvText, normaliseHeader, parseCsvText, readCsvFile, sniffDelimiter } from './csv'

describe('normaliseHeader', () => {
  it('lower-cases, strips accents and collapses separators to one underscore', () => {
    expect(normaliseHeader('Klant Naam')).toBe('klant_naam')
    expect(normaliseHeader('Klant-Naam ')).toBe('klant_naam')
    expect(normaliseHeader('café')).toBe('cafe')
  })
})

describe('sniffDelimiter', () => {
  it('picks whichever separator occurs most in the header line', () => {
    expect(sniffDelimiter('naam;email;telefoon')).toBe(';')
    expect(sniffDelimiter('naam,email,telefoon')).toBe(',')
    expect(sniffDelimiter('naam\temail\ttelefoon')).toBe('\t')
    // No separator at all falls back to ';' (the backend's own default).
    expect(sniffDelimiter('naam')).toBe(';')
  })
})

describe('parseCsvText', () => {
  it('parses a simple semicolon file into normalised headers + data rows', () => {
    const result = parseCsvText('Klant Naam;Email\nAcme;info@acme.nl\n')
    expect(result.headers).toEqual(['klant_naam', 'email'])
    expect(result.rows).toEqual([['Acme', 'info@acme.nl']])
  })

  it('strips a leading UTF-8 BOM', () => {
    const bom = String.fromCharCode(0xfeff)
    const result = parseCsvText(`${bom}naam;email\nAcme;info@acme.nl\n`)
    expect(result.headers).toEqual(['naam', 'email'])
  })

  it('keeps a delimiter or newline embedded in a quoted field intact', () => {
    const result = parseCsvText('naam;omschrijving\nAcme;"Zorg; Welzijn\nen meer"\n')
    expect(result.rows).toEqual([['Acme', 'Zorg; Welzijn\nen meer']])
  })

  it('unescapes a doubled quote inside a quoted field', () => {
    const result = parseCsvText('naam\n"Het ""beste"" bureau"\n')
    expect(result.rows).toEqual([['Het "beste" bureau']])
  })

  it('drops a row whose every cell is blank, mirroring CsvFile.php', () => {
    const result = parseCsvText('naam;email\nAcme;info@acme.nl\n;\n')
    expect(result.rows).toHaveLength(1)
  })

  it('reads the last row even without a trailing newline', () => {
    const result = parseCsvText('naam\nAcme')
    expect(result.rows).toEqual([['Acme']])
  })
})

describe('buildCsvText', () => {
  it('quotes a cell containing the delimiter and joins with CRLF, BOM-prefixed', () => {
    const text = buildCsvText(['naam', 'omschrijving'], [['Acme', 'Zorg; Welzijn']])
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text).toContain('naam;omschrijving\r\n')
    expect(text).toContain('Acme;"Zorg; Welzijn"\r\n')
  })

  it('round-trips through parseCsvText unchanged', () => {
    const headers = ['naam', 'email']
    const rows = [['Acme "Zorg"', 'a@b.nl'], ['De Vries; en Zn', '']]
    const text = buildCsvText(headers, rows)
    const parsed = parseCsvText(text)
    expect(parsed.headers).toEqual(headers)
    expect(parsed.rows).toEqual(rows)
  })
})

describe('readCsvFile', () => {
  it('decodes a valid UTF-8 file as-is', async () => {
    const file = new File(['naam\nMüller'], 'x.csv', { type: 'text/csv' })
    const result = await readCsvFile(file)
    expect(result.rows).toEqual([['Müller']])
  })

  it('falls back to Windows-1252 for a non-UTF-8 export so an accented name is not mangled', async () => {
    // 'é' in Windows-1252 is the single byte 0xE9 — invalid as standalone UTF-8.
    const bytes = new Uint8Array([...'naam\nMuller\xe9'].map((c) => c.charCodeAt(0)))
    const file = new File([bytes], 'x.csv', { type: 'text/csv' })
    const result = await readCsvFile(file)
    expect(result.rows).toEqual([['Mulleré']])
  })
})
