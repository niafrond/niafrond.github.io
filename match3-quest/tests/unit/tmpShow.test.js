import './fixtures/playerForge.js';
import { SCREENS } from '../../story.js';
import { isTerrainBlocked, trackedMarkers } from '../../exploration.js';
import { exitsOf } from './fixtures/gates.js';
test('show', () => {
  const s=SCREENS.fleuve; const m={};
  const put=(e,c)=>{m[`${e.x},${e.y}`]=c;};
  s.enemies.forEach(e=>put(e,'e'));s.npcs.forEach(e=>put(e,'N'));s.chests.forEach(e=>put(e,'C'));exitsOf(s,SCREENS).forEach(e=>put(e,'X'));put(s.spawn,'S');
  let o=`${s.w}x${s.h} conn=${JSON.stringify(Object.fromEntries(Object.entries(s.connections||{}).map(([k,c])=>[k,[c.to,c.range,c.sea,c.requires]])))} exits=${JSON.stringify(s.exits.map(e=>[e.x,e.y,e.to]))}\n`;
  for(let y=0;y<s.h;y++){let r='';for(let x=0;x<s.w;x++)r+=m[`${x},${y}`]||(isTerrainBlocked(s,x,y)?'#':'.');o+=r+'\n';}
  console.log(o);
});
