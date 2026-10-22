import { useEffect, useState } from 'react'
import { emptyDungeon } from '../model/dungeon.js'
import { editHref, navigate } from '../routing.js'
import { browserStorage, createSave, deleteSave, listSaves } from '../storage/saves.js'

const FEATURES = [
  {
    title: 'Can it be beaten?',
    text: 'Every small key, big key, and item is tracked, so you find out whether any order of play reaches the goal.',
  },
  {
    title: 'How could a player get stuck?',
    text: 'Spending a key on the wrong door or taking a drop with no way back. Step through each softlock on the map of your dungeon.',
  },
  {
    title: 'What matters on the way?',
    text: 'See the critical path, the rooms a player can skip, and the rooms nobody can reach.',
  },
]

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function SavedDungeons({ saves, onDelete }) {
  if (saves.length === 0) {
    return <p className="muted">Nothing saved yet. Dungeons you build are saved in this browser automatically.</p>
  }
  return (
    <ul className="save-list">
      {saves.map((save) => (
        <li key={save.id}>
          <a className="save-open" href={editHref(save.id)}>
            <strong>{save.name}</strong>
            <span className="muted">
              {save.rooms} {save.rooms === 1 ? 'room' : 'rooms'} · edited {dateFormat.format(save.updatedAt)}
            </span>
          </a>
          <button type="button" className="danger" onClick={() => onDelete(save)} aria-label={`Delete ${save.name}`}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The front page: what the tool does, a way to start, and your saved dungeons. */
export default function Landing() {
  const [saves, setSaves] = useState(() => listSaves(browserStorage()))

  useEffect(() => {
    document.title = 'Dungeon Delver'
  }, [])

  function startNew() {
    const id = createSave(browserStorage(), emptyDungeon())
    navigate(id ? editHref(id) : '#/scratch')
  }

  function remove(save) {
    if (!window.confirm(`Delete "${save.name}"? This can't be undone.`)) return
    deleteSave(browserStorage(), save.id)
    setSaves(listSaves(browserStorage()))
  }

  return (
    <div className="landing">
      <header className="landing-hero">
        <p className="eyebrow">Dungeon Delver</p>
        <h1>Check that your dungeon can be beaten, before anyone plays it.</h1>
        <p className="lede">
          Sketch how the rooms of a Zelda-style dungeon connect and what locks each door. Dungeon Delver tries every order of play and tells
          you whether the goal can be reached, and every way a player could lock themselves out of it.
        </p>
        <button type="button" className="primary big" onClick={startNew}>
          + New dungeon
        </button>
      </header>

      <main className="landing-body">
        <section aria-labelledby="your-dungeons">
          <h2 id="your-dungeons">Your dungeons</h2>
          <SavedDungeons saves={saves} onDelete={remove} />
        </section>

        <section aria-labelledby="what-it-checks">
          <h2 id="what-it-checks">What it checks</h2>
          <ul className="features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="landing-footer muted">
        <p>
          A fan project. The Legend of Zelda is a trademark of Nintendo; this site isn&apos;t affiliated with or endorsed by Nintendo and uses
          no Nintendo assets.{' '}
          <a href="https://github.com/NightMarethyu/dungeon-delver">Source on GitHub</a>.
        </p>
      </footer>
    </div>
  )
}
