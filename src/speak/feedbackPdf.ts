// Feedback report as a downloadable PDF, with no dependencies.
//
// Arabic needs real shaping and bidi, which small PDF libraries do not give
// us, so each page is laid out on a <canvas> (the browser shapes the text with
// the page's own Cairo font), exported as a JPEG, and wrapped in a hand-built
// PDF. The EnglishX50.com header is drawn on every page.
//
// `buildPdf` (pure) is unit-tested; `renderFeedbackPdf` needs a browser.

import { levelLabel, SCENARIOS } from './scenarios'
import type { Conversation, SpeakFeedback, VocabSuggestions, VocabWord } from './types'

// ---------------------------------------------------------------------------
// Minimal PDF writer: one JPEG image per page
// ---------------------------------------------------------------------------

export interface PdfPage {
  jpeg: Uint8Array
  width: number
  height: number
}

/** A4 in PDF points. */
export const A4 = { width: 595.28, height: 841.89 }

function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/** Build a valid PDF (one image per page, scaled to A4) from JPEG pages. */
export function buildPdf(pages: PdfPage[], meta: { title: string } = { title: 'EnglishX50' }): Uint8Array {
  if (pages.length === 0) throw new Error('No pages')
  const objects: Uint8Array[] = []
  const add = (body: Uint8Array | string) => {
    objects.push(typeof body === 'string' ? ascii(body) : body)
    return objects.length // 1-based object number
  }

  // 1: catalog, 2: pages (patched below), 3: info
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // placeholder for the pages object
  const safeTitle = meta.title.replace(/[^\x20-\x7e]/g, '')
  add(`<< /Title (${safeTitle}) /Producer (EnglishX50) >>`)

  const pageIds: number[] = []
  for (const p of pages) {
    const imageId = add(
      concat([
        ascii(
          `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
        ),
        p.jpeg,
        ascii('\nendstream'),
      ]),
    )
    const content = `q ${A4.width.toFixed(2)} 0 0 ${A4.height.toFixed(2)} 0 0 cm /Im${imageId} Do Q`
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    const pageId = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width.toFixed(2)} ${A4.height.toFixed(2)}] /Resources << /XObject << /Im${imageId} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
    pageIds.push(pageId)
  }
  objects[1] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)

  const parts: Uint8Array[] = [ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')]
  const offsets: number[] = []
  let position = parts[0].length
  objects.forEach((body, i) => {
    offsets.push(position)
    const chunk = concat([ascii(`${i + 1} 0 obj\n`), body, ascii('\nendobj\n')])
    parts.push(chunk)
    position += chunk.length
  })
  const xrefAt = position
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  parts.push(ascii(xref))
  return concat(parts)
}

// ---------------------------------------------------------------------------
// Page layout on canvas
// ---------------------------------------------------------------------------

const SCALE = 2 // canvas pixels per PDF point → crisp text
const W = Math.round(A4.width * SCALE)
const H = Math.round(A4.height * SCALE)
const MARGIN = 44 * SCALE
const HEADER_H = 64 * SCALE
const FOOTER_H = 40 * SCALE
const FONT = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif"

const COLOR = {
  ink: '#1b1730',
  muted: '#7a7596',
  faint: '#a39ec0',
  purple: '#534AB7',
  soft: '#f4f2fc',
  line: '#ece7fb',
  rose: '#B11D54',
  roseBg: '#FFE7F1',
  mint: '#0C7C62',
  mintBg: '#D8FAF0',
}

type Ctx = CanvasRenderingContext2D

interface Block {
  /** Height the block needs; `draw` paints it at y. */
  height: number
  draw: (ctx: Ctx, y: number) => void
}

function wrap(ctx: Ctx, text: string, font: string, maxWidth: number): string[] {
  ctx.font = font
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

interface TextStyle {
  font: string
  color: string
  rtl: boolean
  lineHeight: number
  /** Optional rounded background behind the paragraph. */
  bg?: string
}

function paragraph(ctx: Ctx, text: string, style: TextStyle, width: number, x: number): Block {
  const pad = style.bg ? 10 * SCALE : 0
  const lines = wrap(ctx, text, style.font, width - pad * 2)
  const height = lines.length * style.lineHeight + pad * 2
  return {
    height,
    draw: (c, y) => {
      if (style.bg) {
        c.fillStyle = style.bg
        roundRect(c, x, y, width, height, 8 * SCALE)
        c.fill()
      }
      c.font = style.font
      c.fillStyle = style.color
      c.textBaseline = 'alphabetic'
      c.direction = style.rtl ? 'rtl' : 'ltr'
      c.textAlign = style.rtl ? 'right' : 'left'
      const tx = style.rtl ? x + width - pad : x + pad
      lines.forEach((ln, i) => c.fillText(ln, tx, y + pad + (i + 0.78) * style.lineHeight))
    },
  }
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function spacer(h: number): Block {
  return { height: h, draw: () => {} }
}

/** The EnglishX50.com brand header, drawn on every page. */
function drawHeader(ctx: Ctx, subtitle: string) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  // "50" tile + wordmark (top-right, RTL page)
  const tile = 30 * SCALE
  const tx = W - MARGIN - tile
  const ty = 18 * SCALE
  ctx.fillStyle = COLOR.purple
  roundRect(ctx, tx, ty, tile, tile, 8 * SCALE)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `900 ${11 * SCALE}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = 'ltr'
  ctx.fillText('50', tx + tile / 2, ty + tile / 2 + 1)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'right'
  ctx.font = `900 ${17 * SCALE}px ${FONT}`
  ctx.fillStyle = COLOR.ink
  const wordX = tx - 8 * SCALE
  ctx.fillText('EnglishX50.com', wordX, ty + tile / 2 + 6 * SCALE)
  // subtitle, top-left
  ctx.textAlign = 'left'
  ctx.direction = 'rtl'
  ctx.font = `600 ${10 * SCALE}px ${FONT}`
  ctx.fillStyle = COLOR.muted
  ctx.fillText(subtitle, MARGIN, ty + tile / 2 + 4 * SCALE)
  // rule
  ctx.fillStyle = COLOR.line
  ctx.fillRect(MARGIN, HEADER_H - 2 * SCALE, W - MARGIN * 2, 1.5 * SCALE)
}

function drawFooter(ctx: Ctx, page: number, total: number) {
  ctx.fillStyle = COLOR.line
  ctx.fillRect(MARGIN, H - FOOTER_H, W - MARGIN * 2, 1 * SCALE)
  ctx.font = `600 ${9 * SCALE}px ${FONT}`
  ctx.fillStyle = COLOR.faint
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.fillText('EnglishX50.com', MARGIN, H - FOOTER_H / 2 + 3 * SCALE)
  ctx.textAlign = 'right'
  ctx.fillText(`${page} / ${total}`, W - MARGIN, H - FOOTER_H / 2 + 3 * SCALE)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
}

function feedbackBlocks(ctx: Ctx, fb: SpeakFeedback, width: number, x: number): Block[] {
  const out: Block[] = []
  const lh = 16 * SCALE
  out.push(paragraph(ctx, `✓ ${fb.positive}`, { font: `800 ${11.5 * SCALE}px ${FONT}`, color: COLOR.mint, rtl: true, lineHeight: lh }, width, x))
  if (fb.correction) {
    out.push(spacer(4 * SCALE))
    if (fb.original) {
      out.push(paragraph(ctx, 'قلت:', { font: `700 ${9.5 * SCALE}px ${FONT}`, color: COLOR.faint, rtl: true, lineHeight: 13 * SCALE }, width, x))
      out.push(paragraph(ctx, fb.original, { font: `500 ${11.5 * SCALE}px ${FONT}`, color: COLOR.rose, rtl: false, lineHeight: lh, bg: COLOR.roseBg }, width, x))
      out.push(spacer(4 * SCALE))
    }
    out.push(paragraph(ctx, 'الأفضل:', { font: `700 ${9.5 * SCALE}px ${FONT}`, color: COLOR.faint, rtl: true, lineHeight: 13 * SCALE }, width, x))
    out.push(paragraph(ctx, fb.correction, { font: `700 ${11.5 * SCALE}px ${FONT}`, color: COLOR.mint, rtl: false, lineHeight: lh, bg: COLOR.mintBg }, width, x))
    if (fb.explanationArabic) {
      out.push(spacer(4 * SCALE))
      out.push(paragraph(ctx, `ليه؟ ${fb.explanationArabic}`, { font: `500 ${10.5 * SCALE}px ${FONT}`, color: COLOR.ink, rtl: true, lineHeight: 15 * SCALE }, width, x))
    }
  }
  return out
}

/** One row of the vocabulary table: English word, Arabic meaning, and (upgrades only) the word it replaces. */
function vocabRow(word: VocabWord, width: number, x: number, striped: boolean): Block {
  const hasFrom = Boolean(word.from)
  const height = (hasFrom ? 34 : 25) * SCALE
  const midY = hasFrom ? height * 0.4 : height * 0.5
  return {
    height,
    draw: (c, y) => {
      if (striped) {
        c.fillStyle = COLOR.soft
        c.fillRect(x, y, width, height)
      }
      c.textBaseline = 'alphabetic'
      c.font = `700 ${11.5 * SCALE}px ${FONT}`
      c.fillStyle = COLOR.ink
      c.direction = 'rtl'
      c.textAlign = 'right'
      c.fillText(word.ar, x + width - 12 * SCALE, y + midY + 4 * SCALE)
      c.font = `800 ${11.5 * SCALE}px ${FONT}`
      c.fillStyle = COLOR.purple
      c.direction = 'ltr'
      c.textAlign = 'left'
      c.fillText(word.en, x + 12 * SCALE, y + midY + 4 * SCALE)
      if (word.from) {
        c.font = `500 ${9.5 * SCALE}px ${FONT}`
        c.fillStyle = COLOR.faint
        c.direction = 'rtl'
        c.textAlign = 'right'
        c.fillText(`بدل: ${word.from}`, x + width - 12 * SCALE, y + height - 7 * SCALE)
      }
    },
  }
}

/** One vocabulary group: a purple label followed by its striped rows. */
function vocabGroup(ctx: Ctx, title: string, words: VocabWord[], width: number, x: number): Block[] {
  if (words.length === 0) return []
  const out: Block[] = [
    paragraph(ctx, title, { font: `800 ${12 * SCALE}px ${FONT}`, color: COLOR.purple, rtl: true, lineHeight: 17 * SCALE }, width, x),
    spacer(4 * SCALE),
  ]
  words.forEach((w, i) => out.push(vocabRow(w, width, x, i % 2 === 0)))
  out.push(spacer(16 * SCALE))
  return out
}

/** The three-group vocabulary review table (20 words: missing / contextual / upgrades). */
function vocabBlocks(ctx: Ctx, vocab: VocabSuggestions, width: number, x: number): Block[] {
  const total = vocab.missing.length + vocab.contextual.length + vocab.upgrades.length
  if (total === 0) return []
  return [
    spacer(6 * SCALE),
    paragraph(ctx, 'قائمة مفردات مقترحة', { font: `900 ${16 * SCALE}px ${FONT}`, color: COLOR.ink, rtl: true, lineHeight: 22 * SCALE }, width, x),
    paragraph(
      ctx,
      'كلمات كان يمكن استخدامها، كلمات مقترحة لنفس الموضوع، وكلمات أقوى بدل التي استخدمتها — مع المعنى بالعربي.',
      { font: `600 ${10 * SCALE}px ${FONT}`, color: COLOR.muted, rtl: true, lineHeight: 15 * SCALE },
      width,
      x,
    ),
    spacer(10 * SCALE),
    ...vocabGroup(ctx, '١) كلمات كان يجب استخدامها', vocab.missing, width, x),
    ...vocabGroup(ctx, '٢) كلمات مقترحة لنفس الموضوع', vocab.contextual, width, x),
    ...vocabGroup(ctx, '٣) كلمات أقوى بدل التي استخدمتها', vocab.upgrades, width, x),
  ]
}

/** Lay out the report; returns finished canvases. */
export function layoutFeedbackPages(
  conversation: Conversation,
  makeCanvas: () => HTMLCanvasElement,
  vocabulary?: VocabSuggestions,
): HTMLCanvasElement[] {
  const measure = makeCanvas()
  measure.width = W
  measure.height = H
  const mctx = measure.getContext('2d')
  if (!mctx) throw new Error('Canvas unavailable')

  const width = W - MARGIN * 2
  const x = MARGIN
  const scenario = SCENARIOS.find((s) => s.id === conversation.scenario)
  const turns = (conversation.turns ?? []).filter((t) => t.transcript)
  const minutes = Math.round(conversation.speakingSeconds / 60)
  const subtitle = `${formatDate(conversation.completedAt ?? conversation.startedAt)} · ${scenario?.label ?? ''}`

  const blocks: Block[] = [
    paragraph(mctx, 'ملاحظات Emma على محادثتك', { font: `900 ${20 * SCALE}px ${FONT}`, color: COLOR.ink, rtl: true, lineHeight: 28 * SCALE }, width, x),
    paragraph(
      mctx,
      `${scenario?.emoji ?? ''} ${scenario?.label ?? ''} · المستوى: ${levelLabel(conversation.level)} · ${minutes} دقائق كلام · ${turns.length} إجابات`,
      { font: `600 ${10.5 * SCALE}px ${FONT}`, color: COLOR.muted, rtl: true, lineHeight: 16 * SCALE },
      width,
      x,
    ),
    spacer(10 * SCALE),
  ]
  if (turns.length === 0) {
    blocks.push(paragraph(mctx, 'لم تُسجّل أي إجابة في هذه المحادثة.', { font: `600 ${12 * SCALE}px ${FONT}`, color: COLOR.muted, rtl: true, lineHeight: 18 * SCALE }, width, x))
  }
  turns.forEach((t, i) => {
    const group: Block[] = [
      paragraph(mctx, `إجابتك ${i + 1}`, { font: `800 ${10 * SCALE}px ${FONT}`, color: COLOR.purple, rtl: true, lineHeight: 14 * SCALE }, width, x),
      paragraph(mctx, t.transcript, { font: `500 ${12 * SCALE}px ${FONT}`, color: COLOR.ink, rtl: false, lineHeight: 17 * SCALE, bg: COLOR.soft }, width, x),
      spacer(6 * SCALE),
    ]
    if (t.feedback) group.push(...feedbackBlocks(mctx, t.feedback, width - 12 * SCALE, x + 6 * SCALE))
    group.push(spacer(16 * SCALE))
    // Keep the answer label with at least its text on the same page.
    blocks.push({ height: group[0].height + group[1].height, draw: (c, y) => {
      group[0].draw(c, y)
      group[1].draw(c, y + group[0].height)
    } })
    blocks.push(...group.slice(2))
  })

  if (vocabulary) blocks.push(...vocabBlocks(mctx, vocabulary, width, x))

  // Paginate.
  const top = HEADER_H + 12 * SCALE
  const bottom = H - FOOTER_H - 8 * SCALE
  const pages: Block[][] = [[]]
  let y = top
  for (const b of blocks) {
    if (y + b.height > bottom && pages[pages.length - 1].length > 0) {
      pages.push([])
      y = top
    }
    pages[pages.length - 1].push(b)
    y += b.height
  }

  return pages.map((pageBlocks, i) => {
    const canvas = makeCanvas()
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    drawHeader(ctx, subtitle)
    let yy = top
    for (const b of pageBlocks) {
      b.draw(ctx, yy)
      yy += b.height
    }
    drawFooter(ctx, i + 1, pages.length)
    return canvas
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('toBlob failed'))
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject)
      },
      'image/jpeg',
      0.9,
    )
  })
}

/** Render the conversation's feedback to PDF bytes (browser only). */
export async function renderFeedbackPdf(conversation: Conversation, vocabulary?: VocabSuggestions): Promise<Uint8Array> {
  try {
    await Promise.all([`900 20px ${FONT}`, `700 12px ${FONT}`, `500 12px ${FONT}`].map((f) => document.fonts.load(f)))
  } catch {
    /* fall back to whatever font is available */
  }
  const canvases = layoutFeedbackPages(conversation, () => document.createElement('canvas'), vocabulary)
  const pages: PdfPage[] = []
  for (const c of canvases) pages.push({ jpeg: await canvasToJpeg(c), width: c.width, height: c.height })
  return buildPdf(pages, { title: 'EnglishX50 speaking feedback' })
}

export function feedbackFileName(conversation: Conversation): string {
  const d = new Date(conversation.completedAt ?? conversation.startedAt)
  const stamp = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : 'feedback'
  return `EnglishX50-feedback-${stamp}.pdf`
}

/** Trigger a browser download of `bytes`. */
export function downloadBytes(bytes: Uint8Array, fileName: string, mime = 'application/pdf'): void {
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
