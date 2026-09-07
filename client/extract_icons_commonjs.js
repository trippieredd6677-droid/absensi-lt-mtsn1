const fs = require('fs');
const P = require('./node_modules/@phosphor-icons/react/dist/index.cjs.js');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

const NAMES = [
  'arrow-left','arrow-right','arrow-clockwise','arrows-left-right','arrows-out-line-vertical',
  'calendar-blank','calendar-check','caret-left','caret-right','check','check-circle','check-fat',
  'clipboard-text','clock-clockwise','clock-counter-clockwise','download-simple','envelope-simple',
  'eye','eye-slash','exam','flag','gauge','graduation-cap','image','info','key','list-bullets',
  'lock-key','magnifying-glass','moon','pencil-simple','plus','prohibit','shield-check','sign-out',
  'sun','thermometer','ticket','trash','tree-structure','trend-up','upload-simple','user-circle',
  'users','warning','warning-circle','x','x-circle'
];
const WEIGHTS = ['regular','bold','duotone','fill'];
const pascal = s => s.split('-').map(x => x[0].toUpperCase()+x.slice(1)).join('');

const out = {};
for (const n of NAMES) {
  const Comp = P[pascal(n)];
  if (!Comp) { console.error('MISSING', n); continue; }
  for (const w of WEIGHTS) {
    try {
      out[`${n}:${w}`] = ReactDOMServer.renderToString(React.createElement(Comp, { weight: w }));
    } catch(e) {}
  }
}
fs.writeFileSync('/tmp/phosphor_icons.json', JSON.stringify(out));
console.log('SUCCESS:', Object.keys(out).length);
