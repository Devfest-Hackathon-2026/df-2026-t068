import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import type { Edge, Node } from "@xyflow/react";
import type {
  GraphNodeData,
  SavedNodePositions,
  WorkspaceConcept,
  WorkspaceRelation,
} from "@/features/workspace/types";

type LayoutNode = SimulationNodeDatum & {
  id: string;
  kind: WorkspaceConcept["kind"];
  ideaId: string;
};

function collisionRadius(kind: WorkspaceConcept["kind"]) {
  if (kind === "idea") return 70;
  if (kind === "perspective") return 50;
  return 42;
}

function semanticDistance(strength: number | undefined, fallback: number) {
  if (typeof strength !== "number") return fallback;
  return 220 - Math.max(0, Math.min(1, strength)) * 90;
}

function clusterCenters(ideaIds: string[]) {
  const uniqueIdeas = [...new Set(ideaIds)];
  const radius = uniqueIdeas.length <= 1 ? 0 : Math.max(180, uniqueIdeas.length * 62);
  return new Map(uniqueIdeas.map((ideaId, index) => {
    const angle = -Math.PI / 2 + (index / uniqueIdeas.length) * Math.PI * 2;
    return [ideaId, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }];
  }));
}

export function createForceLayout(
  concepts: WorkspaceConcept[],
  relations: WorkspaceRelation[],
  savedPositions: SavedNodePositions,
) {
  if (concepts.length > 0 && concepts.every((concept) => savedPositions[concept.id])) {
    return new Map(concepts.map((concept) => [concept.id, savedPositions[concept.id]]));
  }

  const centers = clusterCenters(concepts.map((concept) => concept.ideaId));
  const ideaIndexes = new Map<string, number>();
  const nodes: Array<LayoutNode & { fx?: number | null; fy?: number | null }> = concepts.map((concept) => {
    const index = ideaIndexes.get(concept.ideaId) ?? 0;
    ideaIndexes.set(concept.ideaId, index + 1);
    const center = centers.get(concept.ideaId) ?? { x: 0, y: 0 };
    const angle = index * 2.24;
    const orbit = concept.kind === "idea" ? 0 : concept.kind === "perspective" ? 88 : 145;
    const saved = savedPositions[concept.id];
    return {
      id: concept.id,
      ideaId: concept.ideaId,
      kind: concept.kind,
      x: saved?.x ?? center.x + Math.cos(angle) * orbit,
      y: saved?.y ?? center.y + Math.sin(angle) * orbit,
      fx: saved?.x ?? null,
      fy: saved?.y ?? null,
    };
  });

  const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]));

  const links = relations.map((relation) => ({
    source: relation.source,
    target: relation.target,
    kind: relation.kind,
    strength: relation.strength,
    sourceKind: conceptsById.get(relation.source)?.kind,
  }));

  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody<LayoutNode>().strength((node) => node.kind === "idea" ? -430 : node.kind === "perspective" ? -260 : -145))
    .force("center", forceCenter(0, 0).strength(0.025))
    .force("clusterX", forceX<LayoutNode>((node) => centers.get(node.ideaId)?.x ?? 0).strength(0.075))
    .force("clusterY", forceY<LayoutNode>((node) => centers.get(node.ideaId)?.y ?? 0).strength(0.075))
    .force("collision", forceCollide<LayoutNode>().radius((node) => collisionRadius(node.kind)).strength(0.9))
    .force(
      "link",
      forceLink<LayoutNode, (typeof links)[number]>(links)
        .id((node) => node.id)
        .distance((link) => link.kind === "semantic" ? semanticDistance(link.strength, 178) : link.sourceKind === "idea" ? 112 : 84)
        .strength((link) =>
          link.kind === "semantic"
            ? 0.08 + Math.max(0, Math.min(1, link.strength ?? 0.5)) * 0.18
            : 0.52,
        ),
    )
    .stop();

  for (let index = 0; index < 260; index += 1) simulation.tick();

  return new Map(nodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
}

export function relaxFlowLayout(
  flowNodes: Node<GraphNodeData>[],
  flowEdges: Edge[],
  anchorId: string,
) {
  return runFlowSimulation(flowNodes, flowEdges, anchorId, 6, -95);
}

export function settleFlowLayout(
  flowNodes: Node<GraphNodeData>[],
  flowEdges: Edge[],
  anchorId: string,
) {
  return runFlowSimulation(flowNodes, flowEdges, anchorId, 32, -135);
}

function runFlowSimulation(
  flowNodes: Node<GraphNodeData>[],
  flowEdges: Edge[],
  anchorId: string,
  ticks: number,
  charge: number,
) {
  const centers = new Map<string, { x: number; y: number; count: number }>();
  flowNodes.forEach((node) => {
    const current = centers.get(node.data.ideaId) ?? { x: 0, y: 0, count: 0 };
    current.x += node.position.x;
    current.y += node.position.y;
    current.count += 1;
    centers.set(node.data.ideaId, current);
  });
  const nodes: Array<LayoutNode & { fx?: number | null; fy?: number | null }> = flowNodes.map((node) => ({
    id: node.id,
    ideaId: node.data.ideaId,
    kind: node.data.kind,
    x: node.position.x,
    y: node.position.y,
    fx: node.id === anchorId || node.data.pinned ? node.position.x : null,
    fy: node.id === anchorId || node.data.pinned ? node.position.y : null,
  }));
  const links = flowEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    kind: edge.data?.kind === "semantic" ? "semantic" : "hierarchy",
    strength: typeof edge.data?.strength === "number" ? edge.data.strength : undefined,
  }));

  const simulation = forceSimulation(nodes)
    .alpha(ticks > 10 ? 0.38 : 0.18)
    .alphaDecay(ticks > 10 ? 0.1 : 0.2)
    .force("charge", forceManyBody().strength(charge))
    .force("clusterX", forceX<(typeof nodes)[number]>((node) => {
      const center = centers.get(node.ideaId);
      return center ? center.x / center.count : 0;
    }).strength(0.035))
    .force("clusterY", forceY<(typeof nodes)[number]>((node) => {
      const center = centers.get(node.ideaId);
      return center ? center.y / center.count : 0;
    }).strength(0.035))
    .force("collision", forceCollide<(typeof nodes)[number]>().radius((node) => collisionRadius(node.kind)).strength(0.75))
    .force(
      "link",
      forceLink<(typeof nodes)[number], (typeof links)[number]>(links)
        .id((node) => node.id)
        .distance((link) => link.kind === "semantic" ? semanticDistance(link.strength, 180) : 94)
        .strength((link) => link.kind === "semantic" ? 0.08 + Math.max(0, Math.min(1, link.strength ?? 0.5)) * 0.14 : 0.2),
    )
    .stop();

  for (let index = 0; index < ticks; index += 1) simulation.tick();
  const positions = new Map(nodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));

  return flowNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}
