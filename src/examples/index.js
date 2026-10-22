// Original example dungeons, offered on the landing page. They open at
// #/example/<id>, and only become a save of the visitor's own once changed.

import emberSpire from './ember-spire.json'
import mossyHollow from './mossy-hollow.json'
import sunkenCistern from './sunken-cistern.json'

export const EXAMPLES = [
  {
    id: 'mossy-hollow',
    dungeon: mossyHollow,
    blurb: 'A first dungeon on one floor: two small keys, a big key, and a fountain you can skip.',
  },
  {
    id: 'sunken-cistern',
    dungeon: sunkenCistern,
    blurb: 'Two floors and a grapple hook. Spend a key on the storeroom and you can never reach the boss.',
  },
  {
    id: 'ember-spire',
    dungeon: emberSpire,
    blurb: 'Three floors of one-way drops. Fall into the vault too early and there is no way out.',
  },
]
