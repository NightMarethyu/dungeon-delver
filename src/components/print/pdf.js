// A small PDF writer: just enough to draw lines, shapes, the drawn icons and
// plain text, so a map can be downloaded at true size without a library.
// Pure, so it can be tested without the DOM.
//
// Pages are drawn in inches from the top-left corner, like the screen. Text
// uses the two Helvetica fonts every PDF reader has, so nothing is embedded.

const PT = 72

// Helvetica's widths for ASCII 32-126, in thousandths of the font size.
// prettier-ignore
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
// Bold runs a little wider. Close enough to fit names in their rooms.
const BOLD = 1.08

// Characters outside Latin-1 that the fonts' encoding (WinAnsi) still has.
const WIN_ANSI = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99, '‹': 0x8b, '›': 0x9b }

/**
 * `text` in the fonts' encoding, one character per byte. Letters the fonts
 * don't have become '?', so a name in another script still shows something;
 * emoji and other symbols are dropped.
 */
export function encodeText(text) {
  let out = ''
  for (const ch of String(text)) {
    const code = ch.codePointAt(0)
    if (code >= 32 && code < 127) out += ch
    else if (code >= 0xa0 && code <= 0xff) out += ch
    else if (WIN_ANSI[ch]) out += String.fromCharCode(WIN_ANSI[ch])
    else if (/\p{L}|\p{N}/u.test(ch)) out += '?'
  }
  return out.replace(/\s+/g, ' ')
}

/** How wide `text` is, in inches, at `size` points. */
export function textWidth(text, size, bold = false) {
  let units = 0
  for (const ch of encodeText(text)) {
    const code = ch.charCodeAt(0)
    units += code >= 32 && code < 127 ? WIDTHS[code - 32] : 556
  }
  return ((units / 1000) * size * (bold ? BOLD : 1)) / PT
}

/** `text` cut short with an ellipsis so it fits in `width` inches, or '' if not even that fits. */
export function fitText(text, size, width, bold = false) {
  const clean = encodeText(text).trim()
  if (textWidth(clean, size, bold) <= width) return clean
  for (let n = clean.length - 1; n > 0; n--) {
    const cut = `${clean.slice(0, n).trimEnd()}…`
    if (textWidth(cut, size, bold) <= width) return cut
  }
  return ''
}

const num = (n) => {
  const s = (Math.round(n * 1000) / 1000).toString()
  return s === '-0' ? '0' : s
}

const escape = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`)

// '#rrggbb' as PDF color numbers.
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => num(c / 255)).join(' ')
}

/**
 * One page to draw on. Coordinates are inches from the top-left corner, and
 * every method returns the page so calls can be chained.
 */
export class Page {
  constructor(width, height) {
    this.width = width
    this.height = height
    // Flip to inches from the top-left, which the text has to undo.
    this.ops = [`${PT} 0 0 ${-PT} 0 ${num(height * PT)} cm`, '1 J 1 j']
  }

  op(...parts) {
    this.ops.push(parts.join(' '))
    return this
  }

  save() {
    return this.op('q')
  }

  restore() {
    return this.op('Q')
  }

  /** Scale by `k` and move the origin to (x, y), until restored. */
  transform(k, x, y) {
    // Icons scale by a tiny factor, so it keeps more digits than the rest.
    const f = String(Number(k.toPrecision(6)))
    return this.op(f, 0, 0, f, num(x), num(y), 'cm')
  }

  /** Line width in points. */
  lineWidth(points) {
    return this.op(num(points / PT), 'w')
  }

  stroke(hex) {
    return this.op(rgb(hex), 'RG')
  }

  fill(hex) {
    return this.op(rgb(hex), 'rg')
  }

  /** A dash pattern in points; none for solid lines. */
  dash(...points) {
    return this.op(`[${points.map((p) => num(p / PT)).join(' ')}]`, 0, 'd')
  }

  rectPath(x, y, w, h) {
    return this.op(num(x), num(y), num(w), num(h), 're')
  }

  moveTo(x, y) {
    return this.op(num(x), num(y), 'm')
  }

  lineTo(x, y) {
    return this.op(num(x), num(y), 'l')
  }

  curveTo(x1, y1, x2, y2, x, y) {
    return this.op(num(x1), num(y1), num(x2), num(y2), num(x), num(y), 'c')
  }

  close() {
    return this.op('h')
  }

  /** A circle's path, from four curves. */
  circlePath(cx, cy, r) {
    const k = r * 0.5523
    return this.moveTo(cx + r, cy)
      .curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
      .curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
      .curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
      .curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
      .close()
  }

  /** Paint the path: 'S' stroke, 'f' fill, 'B' both, or 'clip' to draw only inside it. */
  paint(how) {
    return how === 'clip' ? this.op('W n') : this.op(how)
  }

  /**
   * Text at (x, y), the left end of its baseline, unless `align` is 'center'
   * or 'right'. `size` is in points.
   */
  text(x, y, text, { size = 10, bold = false, align = 'left', color = '#000000' } = {}) {
    const s = encodeText(text)
    if (!s) return this
    const w = textWidth(s, size, bold)
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
    const k = size / PT
    return this.op('BT', rgb(color), 'rg', `/${bold ? 'F2' : 'F1'}`, 1, 'Tf', num(k), 0, 0, num(-k), num(left), num(y), 'Tm', `(${escape(s)})`, 'Tj', 'ET')
  }

  /**
   * SVG path data (absolute M, L, C and Z only, as the drawn icons use) as
   * this page's path, in the current coordinates.
   */
  svgPath(d) {
    const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
    let cmd = null
    const nums = []
    const flush = () => {
      if (cmd === 'M') this.moveTo(nums[0], nums[1])
      else if (cmd === 'L') this.lineTo(nums[0], nums[1])
      else if (cmd === 'C') this.curveTo(...nums)
      nums.length = 0
    }
    const arity = { M: 2, L: 2, C: 6 }
    for (const t of tokens) {
      if (/^[MLCZ]$/i.test(t)) {
        cmd = t.toUpperCase()
        if (cmd === 'Z') this.close()
        continue
      }
      nums.push(Number(t))
      if (nums.length === arity[cmd]) {
        flush()
        // More numbers after a move are lines, as in SVG.
        if (cmd === 'M') cmd = 'L'
      }
    }
    return this
  }

  get content() {
    return this.ops.join('\n')
  }
}

/**
 * The PDF file for `pages`, each a Page, as bytes.
 * @param {Page[]} pages
 * @param {{ title?: string }} [info]
 * @returns {Uint8Array}
 */
export function pdfBytes(pages, { title = '' } = {}) {
  const objects = []
  const add = (body) => objects.push(body) // object n is objects[n - 1]
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add(null) // the page tree, once the pages are numbered
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  add(`<< /Title (${escape(encodeText(title))}) /Producer (Dungeon Delver) >>`)
  const kids = []
  for (const page of pages) {
    const content = page.content
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    const contentRef = objects.length
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width * PT)} ${num(page.height * PT)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentRef} 0 R >>`,
    )
    kids.push(`${objects.length} 0 R`)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  // Every character is a single byte (see encodeText), so lengths are byte counts.
  const bytes = new Uint8Array(out.length)
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i)
  return bytes
}
