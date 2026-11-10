export type PlacementRect = { x:number; y:number; width:number; height:number };
export type FactorSlot = { id:string; width:number; height:number };
const gap=20;
export function overlaps(a:PlacementRect,b:PlacementRect,padding=gap):boolean {
  return a.x < b.x+b.width+padding && a.x+a.width+padding > b.x && a.y < b.y+b.height+padding && a.y+a.height+padding > b.y;
}
function outsideArea(rect:PlacementRect,bounds:PlacementRect):number {
  const w=Math.max(0,Math.min(rect.x+rect.width,bounds.x+bounds.width)-Math.max(rect.x,bounds.x));
  const h=Math.max(0,Math.min(rect.y+rect.height,bounds.y+bounds.height)-Math.max(rect.y,bounds.y));
  return rect.width*rect.height-w*h;
}
// Only place new factors. Existing idea/factor rectangles are immutable obstacles.
// View bounds are a preference, never a reason to overlap or move the camera.
export function placeFactors(root:PlacementRect,slots:FactorSlot[],obstacles:PlacementRect[],bounds?:PlacementRect):Record<string,PlacementRect> {
  const occupied=[...obstacles];
  const result:Record<string,PlacementRect>={};
  const cx=root.x+root.width/2,cy=root.y+root.height/2;
  for(const [index,slot] of slots.entries()) {
    const preferred=-Math.PI/2+index*2*Math.PI/Math.max(1,slots.length);
    let best:PlacementRect|undefined, bestCost=Infinity;
    for(let ring=0;ring<32;ring++) {
      const radius=240+ring*56;
      for(let step=0;step<36;step++) {
        const angle=preferred+step*2*Math.PI/36;
        const rect={x:cx+Math.cos(angle)*radius-slot.width/2,y:cy+Math.sin(angle)*radius-slot.height/2,width:slot.width,height:slot.height};
        if(occupied.some(other=>overlaps(rect,other)))continue;
        const dx=rect.x+slot.width/2-(cx+Math.cos(preferred)*310),dy=rect.y+slot.height/2-(cy+Math.sin(preferred)*270);
        const outside=bounds?outsideArea(rect,bounds):0;
        const cost=dx*dx+dy*dy+radius*radius*.1+(outside>0?1e9+outside*4:0);
        if(cost<bestCost){best=rect;bestCost=cost;}
      }
    }
    // Even a crowded/dragged layout has free space beyond the rightmost obstacle.
    const placed=best??{x:Math.max(root.x+root.width,...occupied.map(rect=>rect.x+rect.width))+gap,y:cy-slot.height/2,width:slot.width,height:slot.height};
    result[slot.id]=placed;occupied.push(placed);
  }
  return result;
}
