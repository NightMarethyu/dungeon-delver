// The site's light or dark theme. It follows the system setting until the
// visitor picks one, and their pick is remembered in this browser. index.html
// applies a remembered pick before the page first draws, so it doesn't flash.

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'dungeon-delver:theme'
const listeners = new Set()

function readChoice() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

let choice = readChoice()
const systemQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')

const getTheme = () => choice ?? (systemQuery()?.matches ? 'dark' : 'light')

function subscribe(listener) {
  const query = systemQuery()
  listeners.add(listener)
  query?.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    query?.removeEventListener('change', listener)
  }
}

/** Switches to `theme` ('light' or 'dark') and remembers it. */
export function setTheme(theme) {
  choice = theme
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be off limits; the theme still applies for this visit.
  }
  for (const listener of listeners) listener()
}

/** The theme on screen now: 'light' or 'dark'. */
export const useTheme = () => useSyncExternalStore(subscribe, getTheme)
