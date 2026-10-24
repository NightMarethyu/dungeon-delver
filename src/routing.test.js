import { describe, expect, it } from 'vitest'
import { editHref, parseHash, shareHref } from './routing.js'

describe('parseHash', () => {
  it.each([
    ['', { page: 'home' }],
    ['#', { page: 'home' }],
    ['#/', { page: 'home' }],
    ['#/somewhere-else', { page: 'home' }],
    ['#/edit', { page: 'home' }],
    ['#/edit/abc123', { page: 'edit', id: 'abc123' }],
    ['#/scratch', { page: 'scratch' }],
    ['#/share', { page: 'home' }],
    ['#/share/N4Ig+-$x', { page: 'share', data: 'N4Ig+-$x' }],
    ['#/handout/N4Ig+-$x', { page: 'handout', data: 'N4Ig+-$x' }],
    ['#/handout', { page: 'home' }],
    ['#/example', { page: 'home' }],
    ['#/example/mossy-hollow', { page: 'example', id: 'mossy-hollow' }],
  ])('reads %j', (hash, route) => {
    expect(parseHash(hash)).toEqual(route)
  })

  it('round-trips ids through editHref', () => {
    expect(parseHash(editHref('a b/c'))).toEqual({ page: 'edit', id: 'a b/c' })
  })

  it('round-trips share data through shareHref', () => {
    expect(parseHash(shareHref('N4Ig+-$x'))).toEqual({ page: 'share', data: 'N4Ig+-$x' })
  })
})
