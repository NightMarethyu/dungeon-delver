import { describe, expect, it } from 'vitest'
import { keyBelongsTo, shortcutFor } from './shortcuts.js'

const key = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })

describe('shortcutFor', () => {
  it('reads undo and redo with Ctrl or Cmd', () => {
    expect(shortcutFor(key('z', { ctrlKey: true }))).toEqual({ action: 'undo' })
    expect(shortcutFor(key('z', { metaKey: true }))).toEqual({ action: 'undo' })
    expect(shortcutFor(key('Z', { metaKey: true, shiftKey: true }))).toEqual({ action: 'redo' })
    expect(shortcutFor(key('y', { ctrlKey: true }))).toEqual({ action: 'redo' })
  })

  it('leaves other Ctrl, Cmd, and Alt combinations to the browser', () => {
    expect(shortcutFor(key('n', { ctrlKey: true }))).toBeNull()
    expect(shortcutFor(key('s', { metaKey: true }))).toBeNull()
    expect(shortcutFor(key('n', { altKey: true }))).toBeNull()
    expect(shortcutFor(key('z', { ctrlKey: true, altKey: true }))).toBeNull()
  })

  it('reads single keys, in either case', () => {
    expect(shortcutFor(key('n'))).toEqual({ action: 'addRoom' })
    expect(shortcutFor(key('N', { shiftKey: true }))).toEqual({ action: 'addRoom' })
    expect(shortcutFor(key('Backspace'))).toEqual({ action: 'delete' })
    expect(shortcutFor(key('?', { shiftKey: true }))).toEqual({ action: 'help' })
    expect(shortcutFor(key(']'))).toEqual({ action: 'nextFloor' })
    expect(shortcutFor(key('0'))).toEqual({ action: 'fit' })
    expect(shortcutFor(key('q'))).toBeNull()
  })

  it('reads arrows with their direction and Shift', () => {
    expect(shortcutFor(key('ArrowLeft'))).toEqual({ action: 'arrow', dx: -1, dy: 0, shift: false })
    expect(shortcutFor(key('ArrowDown', { shiftKey: true }))).toEqual({ action: 'arrow', dx: 0, dy: 1, shift: true })
  })
})

describe('keyBelongsTo', () => {
  it('leaves keys to fields', () => {
    expect(keyBelongsTo({ tagName: 'INPUT' }, { action: 'delete' })).toBe(true)
    expect(keyBelongsTo({ tagName: 'SELECT' }, { action: 'arrow' })).toBe(true)
    expect(keyBelongsTo({ tagName: 'DIV', isContentEditable: true }, { action: 'addRoom' })).toBe(true)
  })

  it('leaves Enter to buttons, but not other keys', () => {
    expect(keyBelongsTo({ tagName: 'BUTTON' }, { action: 'rename' })).toBe(true)
    expect(keyBelongsTo({ tagName: 'BUTTON' }, { action: 'delete' })).toBe(false)
    expect(keyBelongsTo({ tagName: 'svg' }, { action: 'rename' })).toBe(false)
  })
})
