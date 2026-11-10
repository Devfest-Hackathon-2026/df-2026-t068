import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeFactors,overlaps,type PlacementRect} from '../src/lib/factor-placement.ts';
const slots=(prefix:string)=>Array.from({length:6},(_,i)=>({id:`${prefix}-${i}`,width:210,height:190}));
function assertSeparated(placed:PlacementRect[],obstacles:PlacementRect[]) {
 placed.forEach((rect,index)=>{assert.ok(obstacles.every(other=>!overlaps(rect,other)),JSON.stringify(rect));assert.ok(placed.slice(index+1).every(other=>!overlaps(rect,other)));});
}
test('six new factors avoid idea nodes and leave all existing nodes untouched',()=>{
 const roots=[{x:340,y:10,width:230,height:216},{x:634,y:385,width:230,height:216},{x:45,y:385,width:230,height:216}];
 const before=structuredClone(roots);const placed=placeFactors(roots[0],slots('a'),roots,{x:-150,y:-150,width:1600,height:1100});
 assert.equal(Object.keys(placed).length,6);assertSeparated(Object.values(placed),roots);assert.deepEqual(roots,before);
});
test('five simultaneous expansions never overlap earlier expansions, including crowded roots',()=>{
 const roots=Array.from({length:5},(_,i)=>({x:(i%3)*270,y:Math.floor(i/3)*260,width:230,height:216}));
 const occupied=[...roots];
 for(const [index,root] of roots.entries()){
  const before=structuredClone(occupied);const placed=Object.values(placeFactors(root,slots(String(index)),occupied));
  assertSeparated(placed,occupied);assert.deepEqual(occupied,before);occupied.push(...placed);
 }
 assert.equal(occupied.length,35);
});
test('placement is deterministic and supports negative canvas coordinates',()=>{
 const root={x:-500,y:-350,width:230,height:216};const obstacles=[root,{x:-700,y:-600,width:300,height:300}];
 const a=placeFactors(root,slots('a'),obstacles);assert.deepEqual(a,placeFactors(root,slots('a'),obstacles));assertSeparated(Object.values(a),obstacles);
});
test('available on-screen slots are preferred to closer off-screen slots',()=>{
 const root={x:10,y:10,width:230,height:216};const bounds={x:0,y:0,width:1800,height:1300};
 const placed=Object.values(placeFactors(root,slots('visible'),[root],bounds));
 assertSeparated(placed,[root]);assert.ok(placed.every(rect=>rect.x>=bounds.x&&rect.y>=bounds.y&&rect.x+rect.width<=bounds.width&&rect.y+rect.height<=bounds.height));
});
