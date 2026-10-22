import { ICONS } from './icons.js'

/**
 * One of the drawn icons, recolored for the theme. Works in HTML and, given
 * x and y, nested inside another SVG. Decorative unless given a `title`.
 * @param {{ name: string, size?: number, x?: number, y?: number, title?: string, className?: string }} props
 */
export default function Icon({ name, size = 16, x, y, title, className }) {
  const icon = ICONS[name]
  if (!icon) return null
  return (
    <svg
      className={['icon', `icon-${name}`, className].filter(Boolean).join(' ')}
      viewBox={icon.viewBox}
      width={size}
      height={size}
      // Inline, so sizes set on the map's own <svg> don't stretch it.
      style={{ width: size, height: size }}
      x={x}
      y={y}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {icon.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeMiterlimit={p.strokeMiterlimit} />
      ))}
    </svg>
  )
}
