import { useEffect, useState } from 'react'
import Sheet from '../components/sheet/Sheet.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { HOME_HREF } from '../routing.js'
import { decodeShare } from '../storage/share.js'
import { Missing } from './Builder.jsx'

/**
 * A players' handout opened from its link: the sheet the game master made
 * for them, read only. The link holds nothing the game master didn't choose
 * to show (see playerHandout), so there's nothing here to give away.
 */
export default function Handout({ data }) {
  const [dungeon] = useState(() => decodeShare(data).dungeon)

  useEffect(() => {
    if (dungeon) document.title = `${dungeon.name || 'Untitled Dungeon'} · Player handout`
  }, [dungeon])

  if (!dungeon) {
    return <Missing title="This link doesn't open a handout">It may have been cut short when it was copied. Ask your game master for the link again.</Missing>
  }
  return (
    <div className="app handout-page">
      <header className="app-header">
        <a className="home-link" href={HOME_HREF}>
          ← <span className="home-text">Dungeon Delver</span>
        </a>
        <h1>Player handout</h1>
        <div className="header-actions">
          <button type="button" className="primary" onClick={() => window.print()} title="Print this handout, or save it as a PDF">
            Print
          </button>
          <ThemeToggle />
        </div>
      </header>
      <main className="sheet-main">
        <div className="sheet-workspace">
          <Sheet dungeon={dungeon} audience="players" />
        </div>
      </main>
    </div>
  )
}
