// Sharing a dungeon without a server: the whole dungeon goes in the link,
// as JSON compressed with lz-string into URL-safe characters.
//
// Decoding goes through loadDungeon, like saves do, so links made by an older
// version of the site are migrated on the way in. Nothing here throws.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { loadDungeon } from '../model/load.js'

/** The dungeon as the data part of a share link. */
export function encodeShare(dungeon) {
  return compressToEncodedURIComponent(JSON.stringify(dungeon))
}

/**
 * The dungeon in a share link's data, loaded and migrated.
 * @returns {ReturnType<typeof loadDungeon>} dungeon null when the link is broken
 */
export function decodeShare(data) {
  let json = null
  try {
    json = decompressFromEncodedURIComponent(data)
  } catch {
    // Falls through to the broken-link problem below.
  }
  if (!json) {
    return {
      dungeon: null,
      problems: [{ severity: 'error', code: 'brokenLink', message: "This share link is incomplete or damaged. Try copying it again.", ids: [] }],
    }
  }
  return loadDungeon(json)
}
