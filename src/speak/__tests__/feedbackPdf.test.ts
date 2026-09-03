import { describe, expect, it } from 'vitest'
import { A4, buildPdf } from '../feedbackPdf'

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

describe('buildPdf', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])

  it('writes a well-formed multi-page PDF with one image per page', () => {
    const pdf = buildPdf([
      { jpeg, width: 100, height: 141 },
      { jpeg, width: 100, height: 141 },
      { jpeg, width: 100, height: 141 },
    ])
    const s = text(pdf)
    expect(s.startsWith('%PDF-1.4')).toBe(true)
    expect(s.endsWith('%%EOF\n')).toBe(true)
    expect(s).toContain('/Type /Catalog')
    expect(s).toContain('/Count 3')
    expect(s.match(/\/Type \/Page\b/g)).toHaveLength(3)
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(3)
    expect(s).toContain(`/MediaBox [0 0 ${A4.width.toFixed(2)} ${A4.height.toFixed(2)}]`)
    expect(s).toContain('/Filter /DCTDecode')
    // The JPEG bytes are embedded verbatim.
    expect(s).toContain('\xff\xd8\xff\xe0')
  })

  it('records correct byte offsets in the cross-reference table', () => {
    const pdf = buildPdf([{ jpeg, width: 10, height: 10 }])
    const s = text(pdf)
    const startxref = Number(s.match(/startxref\n(\d+)\n%%EOF/)![1])
    expect(s.slice(startxref, startxref + 4)).toBe('xref')
    const offsets = [...s.matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]))
    expect(offsets.length).toBeGreaterThan(3)
    offsets.forEach((off, i) => expect(s.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
  })

  it('refuses an empty document', () => {
    expect(() => buildPdf([])).toThrow()
  })
})
