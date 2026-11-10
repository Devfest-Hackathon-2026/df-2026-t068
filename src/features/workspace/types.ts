export type ConceptKind = "idea" | "perspective" | "factor";
export type RelationKind = "hierarchy" | "semantic";

export type WorkspaceIdea = {
  id: string;
  title: string;
  originalText: string;
  color: string;
};

export type WorkspaceConcept = {
  id: string;
  kind: ConceptKind;
  ideaId: string;
  parentId?: string;
  label: string;
  perspective?: string;
  description: string;
  evidence: string;
  inferred: boolean;
};

export type WorkspaceRelation = {
  id: string;
  source: string;
  target: string;
  kind: RelationKind;
  reason?: string;
  strength?: number;
};

export type WorkspaceSnapshot = {
  source: "mock" | "analysis";
  ideas: WorkspaceIdea[];
  concepts: WorkspaceConcept[];
  relations: WorkspaceRelation[];
};

export type GraphNodeData = {
  [key: string]: unknown;
  label: string;
  kind: ConceptKind;
  ideaId: string;
  parentId?: string;
  ideaTitle: string;
  color: string;
  perspective?: string;
  description: string;
  evidence: string;
  inferred: boolean;
  pinned: boolean;
};

export type GraphEdgeData = {
  [key: string]: unknown;
  kind: RelationKind;
  reason?: string;
  strength?: number;
};

export type SavedNodePositions = Record<string, { x: number; y: number }>;
