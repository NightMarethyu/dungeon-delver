// Turns the drawn SVG icons in src/assets/icons/ into path data the app can
// render inline and recolor for the theme. Pure, so it can be tested without
// React or a browser.
//
// The drawings stay exactly as drawn: only their colors are swapped. Each
// color an icon uses is mapped to a theme variable (see THEME_COLORS), so the
// same drawing works on the light and dark themes.

// The colors the drawings use, and the theme variables that replace them.
// Variables are defined in index.css. Colors not listed here are kept as drawn.
const THEME_COLORS = {
  stroke: { '#000000': 'var(--icon-ink)' },
  fill: {
    '#000000': 'var(--icon-void)',
    '#ffffff': 'var(--icon-paper)',
    '#999999': 'var(--icon-stone)',
    '#8c6239': 'var(--icon-wood)',
    '#fbb03b': 'var(--icon-gold)',
    '#ed1c24': 'var(--icon-red)',
  },
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]

// The `.cls-n { ... }` rules in a drawing's <style>, as { 'cls-n': { fill: ..., ... } }.
function parseClasses(svg) {
  const classes = {}
  const style = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  for (const [, name, body] of style.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    classes[name] = Object.fromEntries(
      body
        .split(';')
        .map((rule) => rule.split(':').map((s) => s.trim()))
        .filter(([key, value]) => key && value),
    )
  }
  return classes
}

const themed = (kind, color) => (color ? THEME_COLORS[kind][color.toLowerCase()] ?? color : undefined)

/**
 * @param {string} svg the text of one drawn icon
 * @returns {{ viewBox: string, paths: { d: string, fill?: string, stroke?: string, strokeWidth?: number, strokeMiterlimit?: number }[] }}
 */
export function parseIcon(svg) {
  const classes = parseClasses(svg)
  const viewBox = attr(svg.match(/<svg\b[^>]*>/)?.[0] ?? '', 'viewBox') ?? '0 0 1080 1080'
  const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map(([tag]) => {
    const style = { ...classes[attr(tag, 'class')] }
    for (const key of ['fill', 'stroke', 'stroke-width', 'stroke-miterlimit']) {
      const own = attr(tag, key)
      if (own !== undefined) style[key] = own
    }
    const path = { d: attr(tag, 'd') }
    // SVG fills black when no fill is given, so an unstyled path is ink-black.
    path.fill = themed('fill', style.fill ?? '#000000')
    if (style.stroke && style.stroke !== 'none') {
      path.stroke = themed('stroke', style.stroke)
      if (style['stroke-width']) path.strokeWidth = Number(style['stroke-width'])
      if (style['stroke-miterlimit']) path.strokeMiterlimit = Number(style['stroke-miterlimit'])
    }
    return path
  })
  return { viewBox, paths }
}

// Shapes parseIcon doesn't read. A drawing that uses one would lose it, so the
// tests check that none do.
export const UNSUPPORTED_SHAPES = /<(rect|circle|ellipse|line|polyline|polygon|text|image|use)\b/
