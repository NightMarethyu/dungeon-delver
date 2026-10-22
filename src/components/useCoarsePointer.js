import { useSyncExternalStore } from 'react'

// Whether the main pointer is a finger rather than a mouse, so things to grab
// on the canvas can be drawn big enough to hit.
const query = () => window.matchMedia?.('(pointer: coarse)')

function subscribe(listener) {
  query()?.addEventListener('change', listener)
  return () => query()?.removeEventListener('change', listener)
}

export const useCoarsePointer = () => useSyncExternalStore(subscribe, () => query()?.matches ?? false)
