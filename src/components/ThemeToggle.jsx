import { setTheme, useTheme } from '../theme.js'

// Flips between the light and dark themes, showing the one in use.
export default function ThemeToggle() {
  const theme = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      {dark ? '☾ Dark' : '☀ Light'}
    </button>
  )
}
