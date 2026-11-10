"use client";

import Link from "next/link";
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Project } from "@/lib/projects";
import type { IdeaInput, MapPositions } from "@/lib/analysis-data";
import { workspaceToFlow } from "@/features/workspace/graph-adapter";
import { relaxFlowLayout, settleFlowLayout } from "@/features/workspace/layout";
import type {
  GraphEdgeData,
  GraphNodeData,
  WorkspaceSnapshot,
} from "@/features/workspace/types";
import { ConceptNode } from "@/components/workspace/concept-node";
import styles from "./workspace.module.css";

type WorkspaceProps = {
  project: Project;
  projects: Project[];
  snapshot: WorkspaceSnapshot;
  positions: MapPositions;
  ideas: IdeaInput[];
  busy: boolean;
  saveState: string;
  error: string | null;
  stale: boolean;
  onIdeasChange: (ideas: IdeaInput[]) => void;
  onAnalyze: () => void;
  onPositions: (positions: MapPositions) => void;
};

const nodeTypes = { concept: ConceptNode };

export function IdeaWorkspace(props: WorkspaceProps) {
  return (
    <ReactFlowProvider>
      <WorkspaceSurface {...props} />
    </ReactFlowProvider>
  );
}

function WorkspaceSurface({
  project,
  projects,
  snapshot,
  positions,
  ideas,
  busy,
  saveState,
  error,
  stale,
  onIdeasChange,
  onAnalyze,
  onPositions,
}: WorkspaceProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<GraphEdgeData>>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ideasExpanded, setIdeasExpanded] = useState(true);
  const lastRelaxedAt = useRef(0);
  const initialPositions = useRef(positions);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const graph = workspaceToFlow(snapshot, initialPositions.current);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [project.id, setEdges, setNodes, snapshot]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.2, maxZoom: 1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, nodes.length, snapshot]);

  const selectedNodes = useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [nodes, selectedNodeIds],
  );
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  const connectedNodeIds = useMemo(() => {
    const result = new Set(selectedNodeIds);
    edges.forEach((edge) => {
      if (selectedNodeIds.includes(edge.source)) result.add(edge.target);
      if (selectedNodeIds.includes(edge.target)) result.add(edge.source);
    });
    return result;
  }, [edges, selectedNodeIds]);

  const renderedNodes = useMemo(
    () => nodes.map((node) => ({
      ...node,
      className:
        selectedNodeIds.length > 0 && !connectedNodeIds.has(node.id)
          ? styles.dimmedFlowNode
          : undefined,
    })),
    [connectedNodeIds, nodes, selectedNodeIds.length],
  );

  const renderedEdges = useMemo(
    () => edges.map((edge) => {
      const connected = selectedNodeIds.includes(edge.source) || selectedNodeIds.includes(edge.target);
      const selected = edge.id === selectedEdgeId;
      return {
        ...edge,
        animated: false,
        style: {
          ...edge.style,
          opacity: selectedNodeIds.length > 0 && !connected && !selected
            ? 0.26
            : selected || connected
              ? 0.9
              : edge.style?.opacity ?? 0.5,
          strokeWidth: selected
            ? 2.2
            : typeof edge.style?.strokeWidth === "number"
              ? edge.style.strokeWidth
              : edge.data?.kind === "semantic" ? 1.2 : 1,
        },
      };
    }),
    [edges, selectedEdgeId, selectedNodeIds],
  );

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja");
    if (!normalized) return [];
    return nodes.filter((node) =>
      [node.data.label, node.data.ideaTitle, node.data.perspective]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("ja").includes(normalized)),
    ).slice(0, 8);
  }, [nodes, query]);

  const handleSelectionChange = useCallback(
    ({ nodes: nextNodes, edges: nextEdges }: OnSelectionChangeParams) => {
      setSelectedNodeIds(nextNodes.map((node) => node.id));
      setSelectedEdgeId(nextEdges[0]?.id ?? null);
    },
    [],
  );

  const handleNodeDrag = useCallback<OnNodeDrag<Node<GraphNodeData>>>(
    (_event, draggedNode) => {
      const now = Date.now();
      if (now - lastRelaxedAt.current < 55) return;
      lastRelaxedAt.current = now;
      setNodes((current) => {
        const withDraggedPosition = current.map((node) =>
          node.id === draggedNode.id ? { ...node, position: draggedNode.position } : node,
        );
        return relaxFlowLayout(withDraggedPosition, edges, draggedNode.id);
      });
    },
    [edges, setNodes],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<Node<GraphNodeData>>>((_event, draggedNode) => {
    const withDroppedPosition = nodes.map((node) =>
      node.id === draggedNode.id ? { ...node, position: draggedNode.position } : node,
    );
    const settled = settleFlowLayout(withDroppedPosition, edges, draggedNode.id);
    setNodes(settled);
    onPositions(Object.fromEntries(settled.map((node) => [node.id, node.position])));
  }, [edges, nodes, onPositions, setNodes]);

  const selectConcept = useCallback((nodeId: string) => {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeId(null);
    setQuery("");
    const target = nodes.find((node) => node.id === nodeId);
    if (target) void fitView({ nodes: [target], padding: 2.2, maxZoom: 1.25 });
  }, [fitView, nodes, setNodes]);

  const togglePinned = useCallback((nodeId: string) => {
    setNodes((current) => current.map((node) =>
      node.id === nodeId
        ? { ...node, draggable: node.data.pinned, data: { ...node.data, pinned: !node.data.pinned } }
        : node,
    ));
  }, [setNodes]);

  const updateNode = useCallback((nodeId: string, changes: Partial<GraphNodeData>) => {
    setNodes((current) => current.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...changes } } : node,
    ));
  }, [setNodes]);

  const addFactor = useCallback((basis?: Node<GraphNodeData>) => {
    const ideaNode = nodes.find((node) => node.data.kind === "idea");
    const origin = basis ?? ideaNode;
    if (!origin) return;
    const parentId = origin.data.kind === "factor" ? origin.data.parentId : origin.id;
    const id = `manual-factor-${Date.now()}`;
    const nextNode: Node<GraphNodeData> = {
      id,
      type: "concept",
      position: { x: origin.position.x + 110, y: origin.position.y + 90 },
      selected: true,
      data: {
        label: "新しい因数",
        kind: "factor",
        ideaId: origin.data.ideaId,
        parentId,
        ideaTitle: origin.data.ideaTitle,
        color: origin.data.color,
        perspective: origin.data.perspective ?? "未分類",
        description: "",
        evidence: "",
        inferred: false,
        pinned: false,
      },
    };
    const nextEdges = parentId
      ? [...edges, {
        id: `manual-edge-${id}`,
        source: parentId,
        target: id,
        type: "default",
        className: "hierarchyEdge",
        data: { kind: "hierarchy" },
      } satisfies Edge<GraphEdgeData>]
      : edges;
    setEdges(nextEdges);
    const nextNodes = [...nodes.map((node) => ({ ...node, selected: false })), nextNode];
    const settled = settleFlowLayout(nextNodes, nextEdges, id);
    setNodes(settled);
    onPositions(Object.fromEntries(settled.map((node) => [node.id, node.position])));
    setSelectedNodeIds([id]);
    setSelectedEdgeId(null);
  }, [edges, nodes, onPositions, setEdges, setNodes]);

  const deleteFactor = useCallback((nodeId: string) => {
    const nextEdges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    setEdges(nextEdges);
    const settled = settleFlowLayout(nodes.filter((node) => node.id !== nodeId), nextEdges, "");
    setNodes(settled);
    onPositions(Object.fromEntries(settled.map((node) => [node.id, node.position])));
    setSelectedNodeIds([]);
  }, [edges, nodes, onPositions, setEdges, setNodes]);

  const deleteSelectedRelation = useCallback(() => {
    if (!selectedEdge || selectedEdge.data?.kind !== "semantic") return;
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id));
    setSelectedEdgeId(null);
  }, [selectedEdge, setEdges]);

  return (
    <div className={`${styles.workspace} ${sidebarOpen ? "" : styles.sidebarClosed} ${selectedNodes.length === 0 && !selectedEdge ? styles.inspectorClosed : ""}`}>
      <aside className={styles.leftPanel}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} href="/">
            <span>IW</span>
            <strong>IdeaWeave</strong>
          </Link>
          <button aria-label="サイドバーを閉じる" className={styles.iconButton} type="button" onClick={() => setSidebarOpen(false)}>‹</button>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeading}>
            <span>プロジェクト</span>
            <Link aria-label="プロジェクト一覧へ" href="/">＋</Link>
          </div>
          <div className={styles.projectTree}>
            {projects.map((item) => (
              <Link className={item.id === project.id ? styles.activeProject : ""} href={`/projects/${item.id}`} key={item.id}>
                <span className={styles.disclosure}>›</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeading}>
            <span>アイデア</span>
            <span>{ideas.length} / 5</span>
            <button aria-label={ideasExpanded ? "アイデア入力を折りたたむ" : "アイデア入力を開く"} type="button" onClick={() => setIdeasExpanded((current) => !current)}>{ideasExpanded ? "−" : "＋"}</button>
          </div>
          {ideasExpanded ? <div className={styles.ideaEditors}>
            {ideas.map((idea, index) => {
              const graphIdea = snapshot.ideas.find((item) => item.id === idea.id) ?? snapshot.ideas[index];
              const conceptId = snapshot.concepts.find((item) => item.kind === "idea" && item.ideaId === (graphIdea?.id ?? idea.id))?.id;
              return (
                <div className={styles.ideaEditor} key={idea.id}>
                  <div>
                    <button type="button" onClick={() => conceptId && selectConcept(conceptId)}>
                      <span className={styles.ideaDot} style={{ background: graphIdea?.color }} />
                      アイデア {index + 1}
                    </button>
                    {ideas.length > 2 ? <button aria-label={`アイデア ${index + 1}を削除`} disabled={busy} type="button" onClick={() => onIdeasChange(ideas.filter((item) => item.id !== idea.id))}>×</button> : null}
                  </div>
                  <textarea
                    aria-label={`アイデア ${index + 1}`}
                    disabled={busy}
                    maxLength={6000}
                    placeholder="アイデアを入力"
                    rows={3}
                    value={idea.text}
                    onChange={(event) => onIdeasChange(ideas.map((item) => item.id === idea.id ? { ...item, text: event.target.value } : item))}
                  />
                </div>
              );
            })}
          </div> : (
            <ul className={styles.ideaTree}>
              {ideas.map((idea, index) => {
                const graphIdea = snapshot.ideas.find((item) => item.id === idea.id) ?? snapshot.ideas[index];
                const conceptId = snapshot.concepts.find((item) => item.kind === "idea" && item.ideaId === (graphIdea?.id ?? idea.id))?.id;
                return <li key={idea.id}><button type="button" onClick={() => conceptId && selectConcept(conceptId)}><span className={styles.ideaDot} style={{ background: graphIdea?.color }} /><span>アイデア {index + 1}</span></button></li>;
              })}
            </ul>
          )}
          {ideasExpanded ? <button className={styles.addIdeaButton} disabled={busy || ideas.length >= 5} type="button" onClick={() => onIdeasChange([...ideas, { id: crypto.randomUUID(), text: "" }])}>＋ アイデア</button> : null}
        </div>

        <div className={styles.searchArea}>
          <label htmlFor="concept-search">概念を検索</label>
          <input id="concept-search" placeholder="因数・観点・アイデア" value={query} onChange={(event) => setQuery(event.target.value)} />
          {searchResults.length > 0 ? (
            <ul className={styles.searchResults}>
              {searchResults.map((node) => (
                <li key={node.id}>
                  <button type="button" onClick={() => selectConcept(node.id)}>
                    <span>{node.data.label}</span><small>{node.data.perspective ?? "アイデア"}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.sidebarStatus}>
          <span>{saveState}</span>
          <span>{snapshot.source === "mock" ? "グラフ：モック表示" : "グラフ：分析結果"}</span>
        </div>
      </aside>

      <main className={styles.graphPanel}>
        <header className={styles.graphHeader}>
          {!sidebarOpen ? <button aria-label="サイドバーを開く" className={styles.iconButton} type="button" onClick={() => setSidebarOpen(true)}>›</button> : null}
          <div>
            <h1>{project.name}</h1>
            <span>{nodes.length} concepts · {edges.filter((edge) => edge.data?.kind === "semantic").length} relations</span>
          </div>
          <div className={styles.headerActions}>
            <button disabled={busy || ideas.some((idea) => !idea.text.trim())} type="button" onClick={onAnalyze}>{busy ? "分析中…" : snapshot.source === "analysis" ? "再分析" : "分析"}</button>
            <button type="button" onClick={() => addFactor(selectedNodes[0])}>＋ 因数</button>
            <button type="button" onClick={() => void fitView({ padding: 0.22, maxZoom: 1.1 })}>全体表示</button>
          </div>
        </header>

        <div className={styles.flowArea}>
          {stale ? <div className={styles.workspaceNotice}>入力が変更されています。現在は前回の分析結果を表示しています。</div> : null}
          {error ? <div className={styles.workspaceError} role="alert">{error}</div> : null}
          <ReactFlow
            edges={renderedEdges}
            edgesFocusable
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.24, maxZoom: 1.05 }}
            maxZoom={2.2}
            minZoom={0.22}
            multiSelectionKeyCode={["Meta", "Control", "Shift"]}
            nodes={renderedNodes}
            nodesConnectable={false}
            nodeTypes={nodeTypes}
            onEdgesChange={onEdgesChange}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onNodesChange={onNodesChange}
            onSelectionChange={handleSelectionChange}
            panOnDrag
            selectionOnDrag={false}
            zoomOnDoubleClick={false}
          >
            <Background color="#272a31" gap={32} size={1} />
            <MiniMap
              className={styles.miniMap}
              maskColor="rgba(18, 20, 24, 0.72)"
              nodeColor={(node) => String((node.data as GraphNodeData).color)}
              pannable
              zoomable
            />
          </ReactFlow>
          <div className={styles.graphHint}>ホイール：ズーム　ドラッグ：移動　Shift / ⌘：複数選択</div>
        </div>
      </main>

      <InspectorPanel
        edge={selectedEdge}
        nodes={selectedNodes}
        onAddFactor={addFactor}
        onDeleteFactor={deleteFactor}
        onDeleteRelation={deleteSelectedRelation}
        onTogglePinned={togglePinned}
        onUpdateNode={updateNode}
      />
    </div>
  );
}

type InspectorProps = {
  nodes: Node<GraphNodeData>[];
  edge: Edge<GraphEdgeData> | null;
  onTogglePinned: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, changes: Partial<GraphNodeData>) => void;
  onAddFactor: (node?: Node<GraphNodeData>) => void;
  onDeleteFactor: (nodeId: string) => void;
  onDeleteRelation: () => void;
};

function InspectorPanel({ nodes, edge, onTogglePinned, onUpdateNode, onAddFactor, onDeleteFactor, onDeleteRelation }: InspectorProps) {
  const node = nodes[0];
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setEditing(false);
    setLabel(node?.data.label ?? "");
    setDescription(node?.data.description ?? "");
  }, [node?.id, node?.data.description, node?.data.label]);

  if (edge) {
    return (
      <aside className={styles.rightPanel}>
        <div className={styles.inspectorTitle}><span>関連線</span><small>{edge.data?.kind === "semantic" ? "意味的関連" : "階層"}</small></div>
        <section className={styles.inspectorSection}>
          <h2>関連する理由</h2>
          <p>{edge.data?.reason ?? "親子関係を示す階層エッジです。"}</p>
        </section>
        {edge.data?.kind === "semantic" ? <button className={styles.dangerButton} type="button" onClick={onDeleteRelation}>関連線を削除</button> : null}
      </aside>
    );
  }

  if (nodes.length > 1) {
    return (
      <aside className={styles.rightPanel}>
        <div className={styles.inspectorTitle}><span>比較</span><small>{nodes.length}件を選択</small></div>
        <div className={styles.compareList}>
          {nodes.map((item) => (
            <section key={item.id} style={{ borderColor: item.data.color }}>
              <small>{item.data.ideaTitle}</small>
              <h2>{item.data.label}</h2>
              <dl><dt>観点</dt><dd>{item.data.perspective ?? "—"}</dd><dt>説明</dt><dd>{item.data.description || "—"}</dd></dl>
            </section>
          ))}
        </div>
      </aside>
    );
  }

  if (!node) {
    return (
      <aside className={styles.rightPanel}>
        <div className={styles.inspectorTitle}><span>詳細</span></div>
        <div className={styles.emptyInspector}><p>概念または関連線を選択</p><span>複数選択すると比較できます。</span></div>
      </aside>
    );
  }

  const saveChanges = () => {
    onUpdateNode(node.id, { label: label.trim() || node.data.label, description: description.trim() });
    setEditing(false);
  };

  return (
    <aside className={styles.rightPanel}>
      <div className={styles.inspectorTitle}>
        <span>{node.data.kind === "factor" ? "因数" : node.data.kind === "perspective" ? "観点" : "元のアイデア"}</span>
        <button type="button" onClick={() => onTogglePinned(node.id)}>{node.data.pinned ? "固定解除" : "位置を固定"}</button>
      </div>
      <div className={styles.nodeIdentity} style={{ borderColor: node.data.color }}>
        <small>{node.data.ideaTitle}</small>
        {editing ? <input value={label} onChange={(event) => setLabel(event.target.value)} /> : <h2>{node.data.label}</h2>}
      </div>
      <section className={styles.inspectorSection}>
        <dl>
          <dt>観点</dt><dd>{node.data.perspective ?? "—"}</dd>
          <dt>区分</dt><dd>{node.data.inferred ? "AIによる推測" : "元の文章に明示"}</dd>
        </dl>
      </section>
      <section className={styles.inspectorSection}>
        <h3>説明</h3>
        {editing ? <textarea value={description} onChange={(event) => setDescription(event.target.value)} /> : <p>{node.data.description || "説明はありません。"}</p>}
      </section>
      <section className={styles.inspectorSection}>
        <h3>根拠</h3>
        <blockquote>{node.data.evidence || "根拠テキストはありません。"}</blockquote>
      </section>
      <div className={styles.inspectorActions}>
        {node.data.kind === "factor" ? (
          editing
            ? <><button type="button" onClick={saveChanges}>保存</button><button type="button" onClick={() => setEditing(false)}>取消</button></>
            : <><button type="button" onClick={() => setEditing(true)}>編集</button><button type="button" onClick={() => onDeleteFactor(node.id)}>削除</button></>
        ) : <button type="button" onClick={() => onAddFactor(node)}>因数を追加</button>}
      </div>
    </aside>
  );
}
