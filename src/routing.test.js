import { describe, expect, it } from 'vitest'
import { editHref, parseHash } from './routing.js'

describe('parseHash', () => {
  it.each([
    ['', { page: 'home' }],
    ['#', { page: 'home' }],
    ['#/', { page: 'home' }],
    ['#/somewhere-else', { page: 'home' }],
    ['#/edit', { page: 'home' }],
    ['#/edit/abc123', { page: 'edit', id: 'abc123' }],
    ['#/scratch', { page: 'scratch' }],
  ])('reads %j', (hash, route) => {
    expect(parseHash(hash)).toEqual(route)
  })

  it('round-trips ids through editHref', () => {
    expect(parseHash(editHref('a b/c'))).toEqual({ page: 'edit', id: 'a b/c' })
  })
})
