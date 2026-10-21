import { useEffect, useState } from 'react'

// `value`, but only once it has stopped changing for `delay` ms. Used to run
// the solver after a burst of edits (like dragging a room) instead of on each one.
export function useDebounced(value, delay) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}
