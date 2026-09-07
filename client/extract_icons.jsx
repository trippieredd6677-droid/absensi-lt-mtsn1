import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as P from '@phosphor-icons/react'

const NAMES = [
  'arrow-left','arrow-right','arrow-clockwise','arrows-left-right','arrows-out-line-vertical',
  'calendar-blank','calendar-check','caret-left','caret-right','check','check-circle','check-fat',
  'clipboard-text','clock-clockwise','clock-counter-clockwise','download-simple','envelope-simple',
  'eye','eye-slash','exam','flag','gauge','graduation-cap','image','info','key','list-bullets',
  'lock-key','magnifying-glass','moon','pencil-simple','plus','prohibit','shield-check','sign-out',
  'sun','thermometer','ticket','trash','tree-structure','trend-up','upload-simple','user-circle',
  'users','warning','warning-circle','x','x-circle'
]
const WEIGHTS = ['regular','bold','duotone','fill']
const pascal = s => s.split('-').map(x => x[0].toUpperCase()+x.slice(1)).join('')

const out = {}
for (const n of NAMES) {
  const Comp = P[pascal(n)]
  if (!Comp) { console.error('MISSING', n); continue }
  for (const w of WEIGHTS) {
    out[`${n}:${w}`] = renderToStaticMarkup(React.createElement(Comp, { weight: w }))
  }
}
console.log('OK', Object.keys(out).length)
await Bun.write('/tmp/phosphor_icons.json', JSON.stringify(out))
