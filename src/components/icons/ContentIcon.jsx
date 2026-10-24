import Icon from './Icon.jsx'
import { contentIcon } from './icons.js'

/**
 * The icon for a room's content: its drawn icon, or an emoji when the user
 * picked one or the type has no drawing. Decorative, like Icon.
 * @param {{ content: object, size?: number }} props
 */
export default function ContentIcon({ content, size = 16 }) {
  const icon = contentIcon(content)
  if (!icon) return null
  if (icon.name) return <Icon name={icon.name} size={size} />
  return (
    <span className="icon emoji" style={{ width: size, height: size, fontSize: size * 0.85 }} aria-hidden>
      {icon.emoji}
    </span>
  )
}
