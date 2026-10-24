// The dungeon as a printable battle map: each floor at true size, with a
// square or hex grid inside the rooms, one inch a square, for miniatures.
// A floor too big for one sheet of paper is split across pages to tape
// together, after an overview page that shows which page goes where.
// Pure apart from the icons, so it can be tested without the DOM.

import { gateIconName, ICONS, passageIconName } from '../icons/icons.js'
import { floorLinks } from '../map/doors.js'
import { bounds, sharedWall } from '../map/grid.js'
import { playerHandout, sheetSections } from '../sheet/sheet.js'
import { fitText, Page, pdfBytes } from './pdf.js'

export const PAPERS = {
  letter: { label: 'Letter (8.5 × 11 in)', w: 8.5, h: 11 },
  a4: { label: 'A4 (210 × 297 mm)', w: 8.27, h: 11.69 },
}
export const GRIDS = { square: 'Squares', hex: 'Hexes', none: 'No grid' }
// How many inches one square of the builder's map prints at: a 4 × 3 room
// is 4 × 3 grid squares at 1, or 8 × 6 at 2.
export const SCALES = [1, 2, 3, 4]

// The part of a page the map goes on, in whole inches so pages taped
// together keep the grid even. It fits Letter and A4 with room to spare for
// printers that can't print near the edge.
const TILE = { w: 7, h: 9 }
// Inches of space around a floor's rooms.
const PAD = 0.25
// Hexes are an inch across their flat sides, pointy side up.
const HEX_R = 1 / Math.sqrt(3)
const HEX_ROW = 1.5 * HEX_R

const INK = '#000000'
const GRID = '#9a9a9a'
const FAINT = '#777777'
// The drawn icons' theme colors, as printed on white paper (the light theme's).
const ICON_COLORS = {
  'var(--icon-ink)': '#231c17',
  'var(--icon-void)': '#14110f',
  'var(--icon-paper)': '#ffffff',
  'var(--icon-stone)': '#999999',
  'var(--icon-wood)': '#8c6239',
  'var(--icon-gold)': '#fbb03b',
  'var(--icon-red)': '#ed1c24',
}

/** A page's row letter and column number, like a road map: A1, A2, B1. */
export const tileName = (row, col) => `${String.fromCharCode(65 + (row % 26))}${row >= 26 ? Math.floor(row / 26) : ''}${col + 1}`

/**
 * The floors to print for `audience` ('gm' or 'players'): each with its rooms
 * (all with rects), keys as on the notes sheet, and the dungeon its
 * connections come from. The players' floors hold only what their handout does.
 */
export function floorPlans(dungeon, audience = 'gm') {
  const source = audience === 'players' ? playerHandout(dungeon) : dungeon
  const sections = sheetSections(source, audience)
  const keys = new Map(sections.flatMap((s) => s.entries.map((e) => [e.room.id, e.key])))
  return sections.map((s) => ({ floor: s.floor, rooms: s.entries.map((e) => e.room), keys, dungeon: source }))
}

/**
 * How a map `w` × `h` inches splits into pages: the way round (portrait or
 * landscape) that takes fewer, and how many across and down.
 * @returns {{ landscape: boolean, tile: { w: number, h: number }, cols: number, rows: number }}
 */
export function tiling(w, h) {
  const options = [false, true].map((landscape) => {
    const tile = landscape ? { w: TILE.h, h: TILE.w } : TILE
    return { landscape, tile, cols: Math.max(1, Math.ceil(w / tile.w - 1e-9)), rows: Math.max(1, Math.ceil(h / tile.h - 1e-9)) }
  })
  const pages = (o) => o.cols * o.rows
  const [portrait, landscape] = options
  if (pages(portrait) !== pages(landscape)) return pages(portrait) < pages(landscape) ? portrait : landscape
  return w > h ? landscape : portrait
}

// A floor's size and where its rooms start, in inches.
function floorBox(plan, scale) {
  const box = bounds(plan.rooms.map((r) => r.rect))
  return { box, w: box.w * scale + 2 * PAD, h: box.h * scale + 2 * PAD }
}

/**
 * How each floor prints: how it splits into pages, where on those pages it
 * sits (`offset`, in inches, as it's centered), and which of the pages it
 * prints, as pages with no room on them are left out. A floor on more than
 * one page gets an overview page too.
 * @returns {{ plan: object, w: number, h: number, layout: ReturnType<typeof tiling>,
 *   offset: { x: number, y: number }, tiles: { row: number, col: number }[], overview: boolean }[]}
 */
export function printLayout(dungeon, { audience = 'gm', scale = 1 } = {}) {
  return floorPlans(dungeon, audience).map((plan) => {
    const { box, w, h } = floorBox(plan, scale)
    const layout = tiling(w, h)
    const { tile, cols, rows } = layout
    const offset = { x: (cols * tile.w - w) / 2, y: (rows * tile.h - h) / 2 }
    // A room only touching a page by the width of its wall doesn't need it.
    const edge = 0.05
    const rects = plan.rooms.map(({ rect }) => ({
      x: (rect.x - box.x) * scale + PAD + offset.x,
      y: (rect.y - box.y) * scale + PAD + offset.y,
      w: rect.w * scale,
      h: rect.h * scale,
    }))
    const tiles = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * tile.w
        const y = row * tile.h
        const used = rects.some((r) => r.x + r.w > x + edge && r.x < x + tile.w - edge && r.y + r.h > y + edge && r.y < y + tile.h - edge)
        if (used) tiles.push({ row, col })
      }
    }
    return { plan, w, h, layout, offset, tiles, overview: tiles.length > 1 }
  })
}

/** How many pages the map PDF has. */
export const pageCount = (dungeon, options) => printLayout(dungeon, options).reduce((n, f) => n + f.tiles.length + (f.overview ? 1 : 0), 0)

// One of the drawn icons, `size` inches square, its top-left corner at (x, y).
function drawIcon(page, name, x, y, size) {
  const icon = ICONS[name]
  if (!icon) return
  const [, , vw] = icon.viewBox.split(/\s+/).map(Number)
  page.save().transform(size / vw, x, y)
  for (const p of icon.paths) {
    const fill = ICON_COLORS[p.fill] ?? p.fill
    const stroke = p.stroke && (ICON_COLORS[p.stroke] ?? p.stroke)
    if (fill && fill !== 'none') page.fill(fill)
    if (stroke) {
      page.stroke(stroke).op(p.strokeWidth ?? 1, 'w')
      if (p.strokeMiterlimit) page.op(p.strokeMiterlimit, 'M')
    }
    page.svgPath(p.d).paint(fill && fill !== 'none' ? (stroke ? 'B' : 'f') : stroke ? 'S' : 'n')
  }
  page.restore()
}

// Squares an inch apart from the room's corner. Rooms start on whole
// squares, so the lines carry on from room to room.
function squareGrid(page, x, y, w, h) {
  for (let i = 1; i < w - 1e-6; i++) page.moveTo(x + i, y).lineTo(x + i, y + h)
  for (let i = 1; i < h - 1e-6; i++) page.moveTo(x, y + i).lineTo(x + w, y + i)
}

// Hexes over the rect (x, y, w, h), all lined up with the floor's corner so
// they carry on from room to room. Each hex draws only its east, south-east
// and south-west sides, so no side is drawn twice.
function hexGrid(page, x, y, w, h) {
  const corner = (cx, cy, deg) => [cx + HEX_R * Math.cos((deg * Math.PI) / 180), cy + HEX_R * Math.sin((deg * Math.PI) / 180)]
  for (let row = Math.floor(y / HEX_ROW) - 1; row <= Math.ceil((y + h) / HEX_ROW) + 1; row++) {
    const shift = row % 2 === 0 ? 0 : 0.5
    for (let col = Math.floor(x) - 1; col <= Math.ceil(x + w) + 1; col++) {
      const cx = col + shift
      const cy = row * HEX_ROW
      const [a, b, c, d] = [-30, 30, 90, 150].map((deg) => corner(cx, cy, deg))
      page.moveTo(...a).lineTo(...b).lineTo(...c).lineTo(...d)
    }
  }
}

// Where a door goes on the wall between rects `a` and `b`, in inches: a
// square's length (or the whole wall, if shorter) about the wall's middle,
// lined up with the grid.
function doorSpan(a, b, scale) {
  const wall = sharedWall(a, b)
  if (!wall) return null
  const vertical = wall.x1 === wall.x2
  const from = (vertical ? wall.y1 : wall.x1) * scale
  const to = (vertical ? wall.y2 : wall.x2) * scale
  const length = Math.min(1, to - from)
  const start = Math.min(Math.max(Math.round((from + to) / 2 - length / 2), from), to - length)
  const at = (vertical ? wall.x1 : wall.y1) * scale
  return { vertical, at, start, length }
}

/**
 * Draws one floor, in inches with its rooms' corner (less the padding) at
 * the origin. `widths` scales line widths and text, so a floor drawn small on
 * the overview page keeps lines that print.
 */
function drawFloor(page, plan, { scale, grid, widths = 1 }) {
  const { rooms, keys, dungeon } = plan
  const { box } = floorBox(plan, scale)
  const place = (rect) => ({ x: (rect.x - box.x) * scale + PAD, y: (rect.y - box.y) * scale + PAD, w: rect.w * scale, h: rect.h * scale })
  const placed = rooms.map((room) => ({ room, r: place(room.rect) }))
  const byId = new Map(rooms.map((r) => [r.id, r]))

  // Paper white inside the rooms, then the grid, kept inside each room.
  page.fill('#ffffff')
  for (const { r } of placed) page.rectPath(r.x, r.y, r.w, r.h)
  page.paint('f')
  if (grid !== 'none') {
    page.stroke(GRID).lineWidth(0.6 * widths)
    for (const { r } of placed) {
      page.save().rectPath(r.x, r.y, r.w, r.h).paint('clip')
      if (grid === 'hex') hexGrid(page, r.x - PAD, r.y - PAD, r.w + 2 * PAD, r.h + 2 * PAD)
      else squareGrid(page, r.x, r.y, r.w, r.h)
      page.paint('S').restore()
    }
  }

  // Connections without a shared wall: a dashed line between the rooms.
  const doors = []
  page.stroke(FAINT).lineWidth(1.2 * widths).dash(4 * widths, 3 * widths)
  for (const edge of dungeon.edges) {
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    if (!a || !b || a === b) continue
    const span = doorSpan(a.rect, b.rect, scale)
    if (span) {
      doors.push({ edge, span })
      continue
    }
    const ra = place(a.rect)
    const rb = place(b.rect)
    page.moveTo(ra.x + ra.w / 2, ra.y + ra.h / 2).lineTo(rb.x + rb.w / 2, rb.y + rb.h / 2).paint('S')
  }
  page.dash()

  // Walls.
  page.stroke(INK).lineWidth(3 * widths)
  for (const { r } of placed) page.rectPath(r.x, r.y, r.w, r.h)
  page.paint('S')

  // Doors over the walls, with the icon of what locks them.
  const thick = 0.14 * widths
  const ox = PAD - box.x * scale
  const oy = PAD - box.y * scale
  for (const { edge, span } of doors) {
    const x = span.vertical ? span.at + ox - thick / 2 : span.start + ox
    const y = span.vertical ? span.start + oy : span.at + oy - thick / 2
    const w = span.vertical ? thick : span.length
    const h = span.vertical ? span.length : thick
    page.fill('#ffffff').stroke(INK).lineWidth(1 * widths).rectPath(x, y, w, h).paint('B')
    const icon = edge.gate?.type !== 'open' && gateIconName(edge.gate)
    if (icon) {
      const size = Math.min(0.42, span.length) * Math.max(1, widths * 0.6)
      const cx = x + w / 2
      const cy = y + h / 2
      page.fill('#ffffff').lineWidth(0.8 * widths).circlePath(cx, cy, size * 0.62).paint('B')
      drawIcon(page, icon, cx - size / 2, cy - size / 2, size)
    }
  }

  // Each room's key and name in its top-left corner, out of the way of the
  // squares, and its stairs and holes in the bottom-right.
  const links = floorLinks(dungeon, rooms)
  for (const { room, r } of placed) {
    const radius = Math.min(0.15 * widths, r.w / 2 - 0.04, r.h / 2 - 0.04)
    const cx = r.x + radius + 0.07
    const cy = r.y + radius + 0.07
    const key = keys.get(room.id) ?? ''
    const keySize = Math.min(10 * widths, radius * 72 * (key.length > 2 ? 0.8 : 1.15))
    page.fill(INK).circlePath(cx, cy, radius).paint('f')
    page.text(cx, cy + (keySize * 0.36) / 72, key, { size: keySize, bold: true, align: 'center', color: '#ffffff' })
    const nameSize = 8 * widths
    const left = cx + radius + 0.06
    const name = fitText(room.label, nameSize, r.x + r.w - 0.06 - left, true)
    if (name) page.text(left, cy + (nameSize * 0.36) / 72, name, { size: nameSize, bold: true })

    const passages = (links.get(room.id) ?? []).filter((link) => keys.has(link.other)).slice(0, 2)
    const size = Math.min(0.5 * widths, r.w / 3, r.h / 3)
    passages.forEach((link, i) => {
      drawIcon(page, passageIconName(dungeon, link.edge), r.x + r.w - (size + 0.06) * (i + 1), r.y + r.h - size - 0.06, size)
    })
  }
}

// A bar an inch long with a note to print at actual size, to check the scale.
function scaleCheck(page, x, y) {
  page.stroke(INK).lineWidth(1).moveTo(x, y - 0.06).lineTo(x, y + 0.06).moveTo(x, y).lineTo(x + 1, y).moveTo(x + 1, y - 0.06).lineTo(x + 1, y + 0.06).paint('S')
  page.text(x + 1.12, y + 0.04, 'This bar is 1 inch. Print at actual size (100%), not "fit to page".', { size: 7.5, color: FAINT })
}

function header(page, x, y, w, left, right) {
  page.text(x, y, left, { size: 9, bold: true })
  if (right) page.text(x + w, y, right, { size: 9, align: 'right', color: FAINT })
}

/**
 * The battle map as pages of a PDF.
 * @param {object} dungeon
 * @param {{ audience?: 'gm' | 'players', grid?: 'square' | 'hex' | 'none', scale?: number, paper?: 'letter' | 'a4' }} [options]
 * @returns {Page[]}
 */
export function mapPages(dungeon, { audience = 'gm', grid = 'square', scale = 1, paper = 'letter' } = {}) {
  const size = PAPERS[paper] ?? PAPERS.letter
  const name = dungeon.name || 'Untitled Dungeon'
  const floors = printLayout(dungeon, { audience, scale })
  const pages = []
  for (const { plan, layout, offset, tiles, overview } of floors) {
    const { tile, cols, rows, landscape } = layout
    const pw = landscape ? size.h : size.w
    const ph = landscape ? size.w : size.h
    const tx = (pw - tile.w) / 2
    const ty = (ph - tile.h) / 2
    const { x: mx, y: my } = offset
    const printed = (r, c) => tiles.some((t) => t.row === r && t.col === c)
    const title = floors.length > 1 || dungeon.floors.length > 1 ? `${name} · ${plan.floor.name}` : name
    const count = tiles.length

    if (overview) {
      const page = new Page(pw, ph)
      const k = Math.min(tile.w / (cols * tile.w), tile.h / (rows * tile.h))
      const ow = cols * tile.w * k
      const oh = rows * tile.h * k
      const ox = tx + (tile.w - ow) / 2
      const oy = ty + (tile.h - oh) / 2
      header(page, tx, ty - 0.3, tile.w, title, `Overview: how the ${count} pages go together`)
      page.save().transform(k, ox, oy).transform(1, mx, my)
      drawFloor(page, plan, { scale, grid: 'none', widths: 1 / k })
      page.restore()
      page.stroke(FAINT).lineWidth(0.6).dash(3, 2)
      for (let c = 0; c <= cols; c++) page.moveTo(ox + c * tile.w * k, oy).lineTo(ox + c * tile.w * k, oy + oh)
      for (let r = 0; r <= rows; r++) page.moveTo(ox, oy + r * tile.h * k).lineTo(ox + ow, oy + r * tile.h * k)
      page.paint('S').dash()
      for (const { row, col } of tiles) {
        // In the page's corner, clear of the rooms' names.
        page.text(ox + col * tile.w * k + 0.08, oy + row * tile.h * k + 0.28, tileName(row, col), { size: 18, bold: true, color: '#b0b0b0' })
      }
      const note = count < cols * rows ? ' Pages with no rooms on them are left out.' : ''
      page.text(tx, ty + tile.h + 0.3, `Trim each page along its gray border and tape them together as shown. Letters are rows, numbers are columns.${note}`, {
        size: 7.5,
        color: FAINT,
      })
      pages.push(page)
    }

    tiles.forEach(({ row: r, col: c }, i) => {
      const page = new Page(pw, ph)
      header(page, tx, ty - 0.3, tile.w, title, count > 1 ? `Page ${tileName(r, c)} (${i + 1} of ${count})` : null)
      page.save().rectPath(tx, ty, tile.w, tile.h).paint('clip')
      page.transform(1, tx - c * tile.w + mx, ty - r * tile.h + my)
      drawFloor(page, plan, { scale, grid })
      page.restore()
      if (count > 1) {
        page.stroke('#bbbbbb').lineWidth(0.5).rectPath(tx, ty, tile.w, tile.h).paint('S')
        const hint = { size: 8, bold: true, color: FAINT, align: 'center' }
        if (printed(r, c - 1)) page.text(tx / 2, ty + tile.h / 2, tileName(r, c - 1), hint)
        if (printed(r, c + 1)) page.text(tx + tile.w + tx / 2, ty + tile.h / 2, tileName(r, c + 1), hint)
        if (printed(r - 1, c)) page.text(tx + tile.w / 2, ty - 0.06, `${tileName(r - 1, c)} above`, { ...hint, size: 7 })
        if (printed(r + 1, c)) page.text(tx + tile.w / 2, ty + tile.h + 0.16, `${tileName(r + 1, c)} below`, { ...hint, size: 7 })
      }
      scaleCheck(page, tx, ty + tile.h + 0.45)
      pages.push(page)
    })
  }
  return pages
}

/** The battle map as a PDF file's bytes. See mapPages for the options. */
export function mapPdf(dungeon, options) {
  const name = dungeon.name || 'Untitled Dungeon'
  return pdfBytes(mapPages(dungeon, options), { title: `${name} map` })
}

/** A file name for the map, from the dungeon's name. */
export function mapFileName(dungeon) {
  const slug = (dungeon.name || 'dungeon')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
  return `${slug || 'dungeon'}-map.pdf`
}
