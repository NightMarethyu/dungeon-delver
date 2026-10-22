// Hash routing, so every page works on GitHub Pages without a server: the
// path after "#" picks the page.
//
//   #/            the landing page
//   #/edit/<id>   the builder, on a saved dungeon
//   #/scratch     the builder, unsaved (when the browser won't store anything)

import { useSyncExternalStore } from 'react'

/** @returns {{ page: 'home' } | { page: 'edit', id: string } | { page: 'scratch' }} */
export function parseHash(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'edit' && parts[1]) return { page: 'edit', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'scratch') return { page: 'scratch' }
  return { page: 'home' }
}

export const editHref = (id) => `#/edit/${encodeURIComponent(id)}`
export const HOME_HREF = '#/'

export function navigate(href) {
  window.location.hash = href
}

const subscribe = (onChange) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** The current page, from the URL hash. */
export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHash(hash)
}
