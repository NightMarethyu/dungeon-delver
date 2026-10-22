import { useEffect, useRef } from 'react'
import { shortcutList } from '../shortcuts.js'

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

/** The list of keyboard shortcuts, in a modal dialog. Esc or the button closes it. */
export default function ShortcutsDialog({ onClose }) {
  const dialog = useRef(null)

  useEffect(() => {
    dialog.current.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="shortcuts-dialog"
      aria-labelledby="shortcuts-title"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself.
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className="shortcuts-head">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="icon" onClick={() => dialog.current.close()} aria-label="Close" autoFocus>
          ✕
        </button>
      </div>
      {shortcutList(mac).map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <dl>
            {group.rows.map(([keys, what]) => (
              <div key={what}>
                <dt>
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="muted">Shortcuts are off while you&apos;re typing in a field.</p>
    </dialog>
  )
}
