"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { applyNodeChanges, ReactFlow, ReactFlowProvider, useReactFlow, Background, Controls, Handle, Position, type NodeProps, type Node, type Edge } from '@xyflow/react';
import { ideaConnections } from '@/lib/idea-connections';
import { placeFactors, overlaps, type PlacementRect } from '@/lib/factor-placement';
import type { IdeaInput, MapAnalysis, MapPositions } from '@/lib/analysis-data';
import styles from './workspace.module.css';
const colors = ['#7f8fd4', '#6aa99a', '#b38a67', '#9a75b3', '#b36f86'];
function ConnectionHandles() {
  return <>{[Position.Top,Position.Bottom,Position.Left,Position.Right].flatMap(position=>[
    <Handle key={`target-${position}`} id={`target-${position}`} type="target" position={position} className={styles.handle}/>,
    <Handle key={`source-${position}`} id={`source-${position}`} type="source" position={position} className={styles.handle}/>,
  ])}</>;
}
type CardData = { number: number; text: string; target: string; title: string; color: string; expanded: boolean };
function IdeaCard({data}: NodeProps<Node<CardData>>) {
  return <><ConnectionHandles/><article className={styles.networkCard} style={{'--idea-color':data.color} as CSSProperties} title={data.text}><div className={styles.ideaOrb}><span>IDEA {String(data.number).padStart(2,'0')}</span><strong>{data.title}</strong><small>{data.target}</small></div></article></>;
}
type ExpandedFactorData = { ideaId:string; name:string; label:string; broader:string|null; inferred:boolean; color:string; index:number; fromX:number; fromY:number };
function ExpandedFactor({data}:NodeProps<Node<ExpandedFactorData>>) {
  return <><ConnectionHandles/><article className={styles.expandedFactor} style={{'--idea-color':data.color,'--bloom-x':`${data.fromX}px`,'--bloom-y':`${data.fromY}px`,'--bloom-delay':`${data.index*30}ms`} as CSSProperties}><span style={{color:data.color}}>{data.name}{data.inferred ? ' · 推測' : ''}</span><strong>{data.label}</strong>{data.broader&&<small>上位：{data.broader}</small>}</article></>;
}
const nodeTypes = { ideaCard: IdeaCard, expandedFactor: ExpandedFactor };
type NetworkProps = {analysis:MapAnalysis; ideas:IdeaInput[]; positions:MapPositions; onPositions:(positions:MapPositions)=>void; onCompare:(factorId:string)=>void};
export function IdeaNetwork(props:NetworkProps) {
  return <ReactFlowProvider><NetworkCanvas {...props}/></ReactFlowProvider>;
}
function NetworkCanvas({analysis, ideas, positions, onPositions, onCompare}:NetworkProps) {
  const {getViewport}=useReactFlow();
  const canvasRef=useRef<HTMLDivElement>(null);
  const connections = useMemo(()=>ideaConnections(analysis),[analysis]);
  const [selected, setSelected] = useState<string|null>(null);
  const [expandedIdeas, setExpandedIdeas] = useState<string[]>([]);
  const [factorPositions,setFactorPositions] = useState<Record<string,PlacementRect>>({});
  const active = connections.find(connection=>connection.id===selected);
  const number = (id:string)=>ideas.findIndex(idea=>idea.id===id)+1;
  const activeIdeas = active ? [active.source,active.target] : null;
  const generatedNodes = useMemo<Node[]>(()=>{
    const cards:Node[] = ideas.map((idea,index)=>{
    const angle = -Math.PI/2 + index*2*Math.PI/ideas.length;
    const position = ideas.length===2 ? {x:index*460,y:120} : {x:340+Math.cos(angle)*340,y:260+Math.sin(angle)*250};
    return {id:idea.id,type:'ideaCard',position:positions[`network:${idea.id}`]??position,data:{number:index+1,text:idea.text,title:analysis.values.find(v=>v.ideaId===idea.id && v.factorId==='problem')?.label??`アイデア ${index+1}`,target:analysis.values.find(v=>v.ideaId===idea.id && v.factorId==='target')?.label??`アイデア ${index+1}`,color:colors[index],expanded:expandedIdeas.includes(idea.id)},draggable:true,selectable:false,style:{width:230},ariaLabel:`アイデア ${index+1}${expandedIdeas.includes(idea.id)?'（6つの因数を表示中）':''}`};
    });
    const factors:Node[]=expandedIdeas.flatMap(ideaId=>{
      const root=cards.find(card=>card.id===ideaId);
      if(!root)return [];
      const color=colors[ideas.findIndex(idea=>idea.id===ideaId)];
      return analysis.factors.map((factor,index)=>{
        const id=`expanded:${ideaId}:${factor.id}`;
        const position=factorPositions[id];
        if(!position)return null;
        const value=analysis.values.find(value=>value.ideaId===ideaId&&value.factorId===factor.id);
        return {id,type:'expandedFactor',position:{x:position.x,y:position.y},draggable:true,selectable:false,data:{ideaId,name:factor.name,label:value?.label??'情報不足',broader:value?.broaderConcept??null,inferred:value?.inferred??false,color,index,fromX:root.position.x+10-position.x,fromY:root.position.y+35-position.y},style:{width:position.width,height:position.height},ariaLabel:`アイデア ${ideas.findIndex(idea=>idea.id===ideaId)+1}・${factor.name}：${value?.label??'情報不足'}`} satisfies Node;
      }).filter((node):node is NonNullable<typeof node>=>node!==null);
    });
    return [...cards,...factors];
  },[ideas, analysis, positions, expandedIdeas, factorPositions]);
  const [nodes,setNodes] = useState<Node[]>(generatedNodes);
  useEffect(()=>setNodes(generatedNodes),[generatedNodes]);
  function toggleIdea(ideaId:string) {
    setSelected(null);
    if(expandedIdeas.includes(ideaId)) {
      setExpandedIdeas(current=>current.filter(id=>id!==ideaId));
      return;
    }
    const root=nodes.find(node=>node.id===ideaId);
    if(!root)return;
    const box=(node:Node):PlacementRect=>{
      return {x:node.position.x,y:node.position.y,width:node.measured?.width??(node.type==='ideaCard'?230:210),height:node.measured?.height??(typeof node.style?.height==='number'?node.style.height:216)};
    };
    const viewport=getViewport();
    const bounds=canvasRef.current?{x:-viewport.x/viewport.zoom,y:-viewport.y/viewport.zoom,width:canvasRef.current.clientWidth/viewport.zoom,height:canvasRef.current.clientHeight/viewport.zoom}:undefined;
    const canvas=canvasRef.current?.getBoundingClientRect();
    const labelBoxes=canvas&&canvasRef.current?Array.from(canvasRef.current.querySelectorAll('.react-flow__edge-textbg')).map(label=>{
      const rect=label.getBoundingClientRect();
      return {x:(rect.x-canvas.x-viewport.x)/viewport.zoom,y:(rect.y-canvas.y-viewport.y)/viewport.zoom,width:rect.width/viewport.zoom,height:rect.height/viewport.zoom};
    }):[];
    const context=document.createElement('canvas').getContext('2d');
    const family=canvasRef.current?getComputedStyle(canvasRef.current).fontFamily:'sans-serif';
    function lineCount(text:string,size:number,weight:number) {
      if(context)context.font=`${weight} ${size}px ${family}`;
      let lines=1,width=0;
      for(const character of text){const next=context?.measureText(character).width??size;if(width+next>186){lines++;width=0;}width+=next;}
      return lines;
    }
    const slots=analysis.factors.map(factor=>{
      const value=analysis.values.find(value=>value.ideaId===ideaId&&value.factorId===factor.id);
      const height=88+23*lineCount(value?.label??'情報不足',13,700)+(value?.broaderConcept?8+18*lineCount(`上位：${value.broaderConcept}`,10,400):0);
      return {id:`expanded:${ideaId}:${factor.id}`,width:210,height};
    });
    const occupied=[...nodes.map(box),...labelBoxes];
    const remembered:Record<string,PlacementRect>={};
    for(const slot of slots) {
      const saved=factorPositions[slot.id]??positions[`network-factor:${slot.id}`];
      if(!saved)continue;
      const rect={x:saved.x,y:saved.y,width:slot.width,height:slot.height};
      if(occupied.some(other=>overlaps(rect,other)))continue;
      remembered[slot.id]=rect;occupied.push(rect);
    }
    const placed={...remembered,...placeFactors(box(root),slots.filter(slot=>!remembered[slot.id]),occupied,bounds)};
    setFactorPositions(current=>({...current,...placed}));
    setExpandedIdeas(current=>[...current,ideaId]);
  }
  const renderedNodes=nodes.map(node=>({...node,style:{...node.style,opacity:activeIdeas&&!activeIdeas.includes(node.id)&&(!node.data.ideaId||!activeIdeas.includes(node.data.ideaId as string)) ? .25 : 1}}));
  const edges:Edge[] = connections.map(connection=>{
    const a = nodes.find(node=>node.id===connection.source)!.position, b = nodes.find(node=>node.id===connection.target)!.position;
    const dx=b.x-a.x, dy=b.y-a.y;
    const side = Math.abs(dx)>Math.abs(dy) ? (dx>0?Position.Right:Position.Left) : (dy>0?Position.Bottom:Position.Top);
    const opposite = {[Position.Right]:Position.Left,[Position.Left]:Position.Right,[Position.Top]:Position.Bottom,[Position.Bottom]:Position.Top}[side];
    const upperOnly = connection.factors.every(factor=>factor.kind==='broader');
    const dimmed = selected ? selected!==connection.id : false;
    return {id:connection.id,source:connection.source,target:connection.target,sourceHandle:`source-${side}`,targetHandle:`target-${opposite}`,type:'default',label:<>{connection.factors.map((factor,index)=><tspan key={factor.factorId} x={0} dy={index===0?0:18}>{factor.name}{factor.kind==='broader'?'〈上位〉':''}：{factor.label}</tspan>)}</>,style:{stroke:upperOnly?'#d4aa73':'#75b8a9',strokeWidth:2+connection.factors.length,strokeDasharray:upperOnly?'7 5':undefined,opacity:dimmed?.12:1},labelStyle:{fontSize:15,fill:upperOnly?'#e0bd8f':'#a1d3c5',opacity:dimmed?.15:1},labelBgStyle:{fill:'#202329',fillOpacity:.97},labelBgPadding:[9,7],labelBgBorderRadius:6,interactionWidth:26,ariaLabel:`アイデア ${number(connection.source)}と${number(connection.target)}：${connection.factors.map(f=>`${f.name}：${f.label}`).join('、')}`};
  });
  for(const node of nodes.filter(node=>node.type==='expandedFactor')) {
    const source=nodes.find(root=>root.id===node.data.ideaId);
    if(!source)continue;
    const dx=node.position.x+105-(source.position.x+115),dy=node.position.y+21-(source.position.y+108);
    const side=Math.abs(dx)>Math.abs(dy)?(dx>0?Position.Right:Position.Left):(dy>0?Position.Bottom:Position.Top);
    const opposite={[Position.Right]:Position.Left,[Position.Left]:Position.Right,[Position.Top]:Position.Bottom,[Position.Bottom]:Position.Top}[side];
    edges.push({id:`bloom:${node.id}`,source:source.id,target:node.id,sourceHandle:`source-${side}`,targetHandle:`target-${opposite}`,type:'default',selectable:false,style:{stroke:node.data.color as string,strokeWidth:1.5,opacity:.55},ariaLabel:`アイデア ${number(source.id)}の${node.data.name}`});
  }
  return <section aria-label="アイデア同士の全体マップ">
    <div className={styles.expansionToolbar}><p>アイデアをクリックして因数を開閉できます。画面はそのままで、複数の案を同時に開けます。</p><button type="button" disabled={!expandedIdeas.length} onClick={()=>setExpandedIdeas([])}>すべて閉じる</button></div>
    <div ref={canvasRef} className={`${styles.mapCanvas} ${styles.networkCanvas}`}><ReactFlow nodes={renderedNodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{padding:.22}} minZoom={.2} maxZoom={1.6} nodesConnectable={false} autoPanOnNodeFocus={false} autoPanOnNodeDrag={false} deleteKeyCode={null} onEdgeClick={(_,edge)=>{if(edge.id.startsWith('bloom:'))return;setSelected(edge.id);}} onNodeClick={(_,node)=>{if(node.type!=='ideaCard')return;toggleIdea(node.id);}} onPaneClick={()=>{setSelected(null);}} selectNodesOnDrag={false} multiSelectionKeyCode={null} nodeClickDistance={5} onNodesChange={changes=>setNodes(current=>applyNodeChanges(changes,current))} onNodeDragStop={(_,node)=>{
      if(node.type==='ideaCard')onPositions({...positions,[`network:${node.id}`]:node.position});
      if(node.type==='expandedFactor'){
        setFactorPositions(current=>({...current,[node.id]:{...current[node.id],...node.position}}));
        onPositions({...positions,[`network-factor:${node.id}`]:node.position});
      }
    }}><Background gap={24} color="#272a31"/><Controls showInteractive={false}/></ReactFlow></div>
    <div className={styles.networkLinks} aria-label="接続を選ぶ">{connections.length===0?<p>現在の基準で接点は見つかりませんでした。各案の因数は下で確認できます。</p>:connections.map(connection=><button key={connection.id} aria-pressed={selected===connection.id} onClick={()=>{setSelected(connection.id);}}>案{number(connection.source)} ↔ 案{number(connection.target)}<span>{connection.factors.map(f=>`${f.name}${f.kind==='broader'?'〈上位〉':''}：${f.label}`).join('・')}</span></button>)}</div>
    {active&&<section className={styles.linkDetail} aria-label="選択した接点の詳細"><h3>アイデア {number(active.source)} ↔ {number(active.target)}<span>{active.factors.length}つの因数に接点</span></h3>{active.factors.map(factor=><article key={factor.factorId}><div><span>{factor.name} · {factor.kind==='broader'?'上位概念が近い':'具体的な意味が近い'}</span><strong>{factor.label}</strong></div><p>案{number(active.source)}：{factor.sourceValue}</p><p>案{number(active.target)}：{factor.targetValue}</p><button onClick={()=>onCompare(factor.factorId)}>この因数を詳しく比較 ↗</button></article>)}<p className={styles.hint}>接点は組み合わせを考える手がかりです。案の良さや実現可能性の評価ではありません。</p></section>}
  </section>;
}
