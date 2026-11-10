import type { Edge, Node } from "@xyflow/react";
import { createForceLayout } from "@/features/workspace/layout";
import type {
  GraphEdgeData,
  GraphNodeData,
  SavedNodePositions,
  WorkspaceSnapshot,
} from "@/features/workspace/types";

export function workspaceToFlow(
  snapshot: WorkspaceSnapshot,
  savedPositions: SavedNodePositions = {},
): { nodes: Node<GraphNodeData>[]; edges: Edge<GraphEdgeData>[] } {
  const ideas = new Map(snapshot.ideas.map((idea) => [idea.id, idea]));
  const concepts = new Map(snapshot.concepts.map((concept) => [concept.id, concept]));
  const positions = createForceLayout(snapshot.concepts, snapshot.relations, savedPositions);

  return {
    nodes: snapshot.concepts.map((concept) => {
      const idea = ideas.get(concept.ideaId);
      return {
        id: concept.id,
        type: "concept",
        position: positions.get(concept.id) ?? { x: 0, y: 0 },
        data: {
          label: concept.label,
          kind: concept.kind,
          ideaId: concept.ideaId,
          parentId: concept.parentId,
          ideaTitle: idea?.title ?? "不明なアイデア",
          color: idea?.color ?? "#7f8fd4",
          perspective: concept.perspective,
          description: concept.description,
          evidence: concept.evidence,
          inferred: concept.inferred,
          pinned: false,
        },
      };
    }),
    edges: snapshot.relations.map((relation) => {
      const sourceConcept = concepts.get(relation.source);
      const ideaColor = sourceConcept ? ideas.get(sourceConcept.ideaId)?.color : undefined;
      return {
        id: relation.id,
        source: relation.source,
        target: relation.target,
        type: "default",
        selectable: true,
        interactionWidth: 18,
        className: relation.kind === "semantic" ? "semanticEdge" : "hierarchyEdge",
        style: relation.kind === "hierarchy"
          ? { stroke: ideaColor ?? "#777d89", opacity: 0.34, strokeWidth: 1 }
          : { stroke: "#8a8fa8", opacity: 0.5, strokeWidth: 0.8 + Math.max(0, Math.min(1, relation.strength ?? 0.5)) * 0.8 },
        data: { kind: relation.kind, reason: relation.reason, strength: relation.strength },
      };
    }),
  };
}
