// Hash routing, so every page works on GitHub Pages without a server: the
// path after "#" picks the page.
//
//   #/            the landing page
//   #/edit/<id>   the builder, on a saved dungeon
//   #/scratch     the builder, unsaved (when the browser won't store anything)
//   #/share/<data> the builder, on a shared dungeon carried in the link itself
//   #/example/<id> the builder, on one of the example dungeons
//   #/handout/<data> a players' handout, read only, carried in the link itself

import { useSyncExternalStore } from 'react'

/** @returns {{ page: 'home' } | { page: 'edit', id: string } | { page: 'scratch' } | { page: 'share', data: string } | { page: 'example', id: string } | { page: 'handout', data: string }} */
export function parseHash(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'edit' && parts[1]) return { page: 'edit', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'scratch') return { page: 'scratch' }
  if (parts[0] === 'share' && parts[1]) return { page: 'share', data: parts[1] }
  if (parts[0] === 'example' && parts[1]) return { page: 'example', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'handout' && parts[1]) return { page: 'handout', data: parts[1] }
  return { page: 'home' }
}

export const editHref = (id) => `#/edit/${encodeURIComponent(id)}`
export const shareHref = (data) => `#/share/${data}`
export const handoutHref = (data) => `#/handout/${data}`
export const exampleHref = (id) => `#/example/${encodeURIComponent(id)}`
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
