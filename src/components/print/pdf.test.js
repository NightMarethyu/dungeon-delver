import { describe, expect, it } from 'vitest'
import { encodeText, fitText, Page, pdfBytes, textWidth } from './pdf.js'

const text = (bytes) => String.fromCharCode(...bytes)

describe('encodeText', () => {
  it('keeps Latin-1 and turns letters the fonts lack into ?', () => {
    expect(encodeText('Café')).toBe('Café')
    expect(encodeText('Dragon’s 竜')).toBe('Dragon\x92s ?')
  })

  it('drops emoji', () => {
    expect(encodeText('🐉 Lair')).toBe(' Lair')
  })
})

describe('fitText', () => {
  it('cuts long text short with an ellipsis', () => {
    expect(fitText('Hall', 10, 2)).toBe('Hall')
    const cut = fitText('The Very Long Hall of Many Echoes', 10, 1)
    expect(cut.endsWith('…')).toBe(true)
    expect(textWidth(cut, 10)).toBeLessThanOrEqual(1)
  })
})

describe('pdfBytes', () => {
  it('writes a PDF whose cross-reference table points at its objects', () => {
    const page = new Page(8.5, 11).rectPath(1, 1, 2, 2).paint('S').text(1, 1, 'Hi (there)')
    const pdf = text(pdfBytes([page, new Page(11, 8.5)], { title: 'Test' }))
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('/Count 2')
    expect(pdf).toContain('/MediaBox [0 0 612 792]')
    expect(pdf).toContain('(Hi \\(there\\)) Tj')
    const xref = Number(pdf.match(/startxref\n(\d+)/)[1])
    expect(pdf.slice(xref, xref + 4)).toBe('xref')
    const offsets = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    offsets.forEach((o, i) => expect(pdf.slice(o).startsWith(`${i + 1} 0 obj`)).toBe(true))
  })

  it('draws SVG path data as PDF path operators', () => {
    const page = new Page(1, 1).svgPath('M1 2 L3 4 C5 6 7 8 9 10 Z')
    expect(page.content).toContain('1 2 m\n3 4 l\n5 6 7 8 9 10 c\nh')
  })
})
