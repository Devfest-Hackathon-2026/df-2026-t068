"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, applyNodeChanges, type Node, type Edge, type NodeChange, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { IdeaInput, MapAnalysis, MapPositions } from "@/lib/analysis-data";
import { connectionGroups } from "@/lib/map-groups";
import { IdeaNetwork } from "./idea-network";
import { FactorOverview } from "./factor-overview";
import styles from "./workspace.module.css";

const colors = ["#7f8fd4", "#6aa99a", "#b38a67", "#9a75b3", "#b36f86"];
type FactorData = { factor: string; label: string; inferred: boolean };
function FactorNode({ data }: NodeProps<Node<FactorData>>) {
  return <><Handle type="target" position={Position.Top} id="tree" className={styles.handle} /><Handle type="target" position={Position.Left} id="idea" className={styles.handle} /><div className={styles.factorNode}><span>{data.factor}{data.inferred ? " · 推測" : ""}</span><strong>{data.label}</strong></div><Handle type="source" position={Position.Right} id="shared" className={styles.handle} /></>;
}
type SharedData = { label: string; partial: boolean; members: string };
function SharedNode({ data }: NodeProps<Node<SharedData>>) {
  return <><Handle type="target" position={Position.Left} id="members" className={styles.handle} /><div className={styles.sharedNode}><span>{data.partial ? "上位概念の関連候補" : "意味の近い共通値"}</span><strong>{data.label}</strong><small>{data.members}</small></div></>;
}
const nodeTypes = { factor: FactorNode, shared: SharedNode };
type MapProps = { analysis: MapAnalysis; ideas: IdeaInput[]; positions: MapPositions; onPositions: (positions: MapPositions) => void };

export function IdeaMap(props: MapProps) {
  const [mode, setMode] = useState<"network" | "compare" | "tree">("network");
  const [factorId, setFactorId] = useState(props.analysis.factors[0]?.id ?? "target");
  return <>
    <div className={styles.mapToolbar}>
      <div className={styles.modeButtons} aria-label="マップの表示方法"><button type="button" aria-pressed={mode === "network"} onClick={() => setMode("network")}>全体のつながり</button><button type="button" aria-pressed={mode === "compare"} onClick={() => setMode("compare")}>因数ごとに比較</button><button type="button" aria-pressed={mode === "tree"} onClick={() => setMode("tree")}>全体ツリー</button></div>
      {mode === "compare" && <label className={styles.factorSelect}>比較する因数<select value={factorId} onChange={event => setFactorId(event.target.value)}>{props.analysis.factors.map(factor => <option value={factor.id} key={factor.id}>{factor.name}</option>)}</select></label>}
    </div>
    {mode !== "network" && <p className={styles.mapInstruction}>{mode === "compare" ? "左からアイデア → 因数の値 → 共通する値。ノードを選ぶと、その関係だけを強調します。" : "各案の6因数を俯瞰します。案を横断する関係は「因数ごとに比較」で確認できます。"}</p>}
    {mode === "network" ? <IdeaNetwork {...props} onCompare={id => { setFactorId(id); setMode("compare"); }} /> : <MapCanvas key={`${mode}-${factorId}`} {...props} mode={mode} factorId={factorId} />}
    <FactorOverview analysis={props.analysis} ideas={props.ideas} onCompare={id => { setFactorId(id); setMode("compare"); }} />
  </>;
}

function MapCanvas({ analysis, ideas, positions, onPositions, mode, factorId }: MapProps & { mode: "compare" | "tree"; factorId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const generated = useMemo(() => {
    const nodes: Node[] = []; const edges: Edge[] = [];
    const factor = analysis.factors.find(f => f.id === factorId);
    const nodeId = (id: string) => mode === "compare" ? `compare:${factorId}:${id}` : `tree:v2:${id}`;
    // Align factor rows using the tallest measured card in each row, not a fixed pitch.
    // A new position namespace avoids retaining the old fixed-height arrangement.
    let nextRowY = Math.max(82, ...ideas.map(idea => heights[nodeId(`root-${idea.id}`)] ?? 82)) + 32;
    const rowY = analysis.factors.map(f => {
      const y = nextRowY;
      const rowHeight = Math.max(72, ...ideas.map(idea => {
        const value = analysis.values.find(v => v.ideaId === idea.id && v.factorId === f.id);
        return heights[nodeId(value?.id ?? `missing-${idea.id}-${f.id}`)] ?? 72;
      }));
      nextRowY += rowHeight + 24;
      return y;
    });
    ideas.forEach((idea, i) => {
      const root = nodeId(`root-${idea.id}`);
      nodes.push({ id: root, type: "input", sourcePosition: mode === "compare" ? Position.Right : Position.Bottom, position: positions[root] ?? (mode === "compare" ? { x: 0, y: i * 160 } : { x: i * 380, y: 0 }), data: { label: <div className={styles.treeRoot} style={{"--idea-color":colors[i]} as CSSProperties}><strong>アイデア {i + 1}</strong><p className={styles.rootText}>{idea.text.slice(0, 44)}{idea.text.length > 44 ? "…" : ""}</p></div> }, style: { width: 240, minHeight: 82, borderColor: colors[i], borderWidth: 0, borderRadius: 0, background: "transparent" } });
      const factors = mode === "compare" ? (factor ? [factor] : []) : analysis.factors;
      factors.forEach((f, j) => {
        const value = analysis.values.find(v => v.ideaId === idea.id && v.factorId === f.id);
        const id = nodeId(value?.id ?? `missing-${idea.id}-${f.id}`);
        nodes.push({ id, type: "factor", position: positions[id] ?? (mode === "compare" ? { x: 320, y: i * 160 + 5 } : { x: i * 380 + 5, y: rowY[j] }), data: { factor: f.name, inferred: value?.inferred ?? false, label: value?.label ?? "情報不足" }, style: { width: 230, minHeight: 72, padding: 12, color:value ? colors[i] : "#6c7382", border: "none", borderRadius: 0, background: "transparent" } });
        edges.push({ id: `tree-${id}`, source: root, target: id, targetHandle: mode === "compare" ? "idea" : "tree", type: "smoothstep", style: { stroke: colors[i], opacity: 0.35 } });
      });
    });
    if (mode === "compare") {
      const groups = connectionGroups(analysis, factorId).map(group => {
        const rows = group.memberIds.map(id => ideas.findIndex(idea => idea.id === analysis.values.find(v => v.id === id)?.ideaId)).filter(index => index >= 0);
        return { ...group, y: rows.reduce((sum, row) => sum + row * 160, 0) / Math.max(1, rows.length) };
      }).sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
      let bottom = -130;
      for (const group of groups) {
        const y = Math.max(group.y, bottom + 130); bottom = y;
        const id = `common:${group.id}`;
        const partial = group.kind === "broader-concept";
        const numbers = group.memberIds.map(id => ideas.findIndex(idea => idea.id === analysis.values.find(v => v.id === id)?.ideaId) + 1).sort((a, b) => a - b);
        nodes.push({ id, type: "shared", position: positions[id] ?? { x: 740, y }, data: { label: group.label, partial, members: `アイデア ${numbers.join("・")}` }, style: { width: 250, minHeight: 100, padding: 16, borderRadius: 0, color: partial ? "#d4aa73" : "#75b8a9", background:"transparent", border:"none" } });
        for (const member of group.memberIds) edges.push({ id: `member:${id}:${member}`, source: nodeId(member), sourceHandle: "shared", target: id, targetHandle: "members", type: "default", style: { stroke: partial ? "#d4aa73" : "#75b8a9", strokeWidth: 2, strokeDasharray: partial ? "4 5" : undefined } });
      }
    }
    return { nodes, edges };
  }, [analysis, ideas, positions, mode, factorId, heights]);
  const [nodes, setNodes] = useState<Node[]>(generated.nodes);
  useEffect(() => setNodes(generated.nodes), [generated.nodes]);
  function changeNodes(changes: NodeChange<Node>[]) {
    setNodes(current => applyNodeChanges(changes, current));
    if (mode !== "tree") return;
    setHeights(previous => {
      const updates = changes.flatMap(change => change.type === "dimensions" && change.dimensions && previous[change.id] !== change.dimensions.height ? [[change.id, change.dimensions.height] as const] : []);
      if (!updates.length) return previous;
      return { ...previous, ...Object.fromEntries(updates) };
    });
  }
  useEffect(() => {
    if (nodes.some(node => node.dragging)) return;
    const moved = nodes.some(node => { const original = generated.nodes.find(item => item.id === node.id); return original && (original.position.x !== node.position.x || original.position.y !== node.position.y); });
    if (!moved) return;
    const timer = setTimeout(() => onPositions({ ...positions, ...Object.fromEntries(nodes.map(node => [node.id, node.position])) }), 400);
    return () => clearTimeout(timer);
  }, [nodes, generated.nodes, onPositions, positions]);
  const focus = new Set<string>();
  const highlightedEdges = new Set<string>();
  if (selected) {
    focus.add(selected);
    const commons = new Set(generated.edges.filter(edge => edge.id.startsWith("member:") && (edge.source === selected || edge.target === selected)).map(edge => edge.target));
    for (const edge of generated.edges.filter(edge => edge.id.startsWith("tree-") && edge.source === selected)) {
      focus.add(edge.target);
      generated.edges.filter(item => item.source === edge.target && item.id.startsWith("member:")).forEach(item => commons.add(item.target));
    }
    for (const edge of generated.edges) if (commons.has(edge.target) || (mode === "tree" && (edge.source === selected || edge.target === selected))) { focus.add(edge.source); focus.add(edge.target); highlightedEdges.add(edge.id); }
    for (const edge of generated.edges) if (edge.id.startsWith("tree-") && (focus.has(edge.target) || edge.source === selected)) { focus.add(edge.source); focus.add(edge.target); highlightedEdges.add(edge.id); }
  }
  const renderedNodes = nodes.map(node => ({ ...node, style: { ...node.style, opacity: selected && !focus.has(node.id) ? 0.25 : 1 } }));
  const edges = generated.edges.map(edge => ({ ...edge, style: { ...edge.style, opacity: selected && !highlightedEdges.has(edge.id) ? 0.07 : edge.style?.opacity ?? 1 } }));
  const groupCount = generated.nodes.filter(node => node.type === "shared").length;
  return <>
    {selected && <div className={styles.focusBar} role="status">選択したノードの関係を強調しています<button type="button" onClick={() => setSelected(null)}>選択を解除</button></div>}
    {mode === "compare" && groupCount === 0 && <p className={styles.noShared}>この因数には、現在の基準で共通する値がありません。</p>}
    <div className={styles.mapCanvas} aria-label="アイデアの因数と共通部分のマップ">
      <ReactFlow nodes={renderedNodes} nodeTypes={nodeTypes} edges={edges} onNodesChange={changeNodes} onNodeClick={(_, node) => setSelected(node.id)} onPaneClick={() => setSelected(null)} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.15} maxZoom={1.8} nodesConnectable={false} deleteKeyCode={null}>
        <Background gap={22} color="#272a31" /><MiniMap style={{background:"#1c1e23"}} maskColor="rgba(18,20,24,.72)" nodeColor="#7f8fd4" pannable zoomable /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
  </>;
}
