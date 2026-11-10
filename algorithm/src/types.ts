export interface Factor { id: string; name: string; description: string }
export interface Config {
  version: string; factors: Factor[]; maxValuesPerIdea: number; maxIdeas: number;
  maxTextLength: number; maxLabelLength: number; maxCandidates: number; maxLabels: number;
  similarityThreshold: number; minimumLabelSimilarity: number;
  embeddingMode: 'label' | 'context' | 'meaning';
  factorThresholds?: Record<string, number>;
  minimumLabelMemberSimilarity?: number;
  preferredLabelLength?: number;
  abstractionThreshold?: number;
  abstractionFactorThresholds?: Record<string, number>;
  semanticCandidateThreshold?: number;
  maxSemanticPairs?: number;
}
export interface Idea { id: string; text: string }
export interface ExtractedValue {
  factorId: string; label: string; description: string; evidence: string; inferred: boolean;
  broaderConcept?: string | null;
}
export interface Value extends ExtractedValue { id: string; ideaId: string }
export interface EmbeddedValue extends Value { vector: number[]; broaderVector?: number[] }
export interface Pair { source: string; target: string; factorId: string; score: number }
export interface BroaderPair extends Pair { kind: 'broader-concept'; sourceConcept: string; targetConcept: string; sharedConcept: string; method?: 'semantic' }
export interface LabelResult {
  id: string; factorId: string; memberIds: string[]; label: string;
  centroid: number[]; score: number; status: 'candidate-selected' | 'fallback-original';
  candidates: { label: string; score: number; memberScore?: number; eligible?: boolean; vector?: number[] }[];
  level?: 'direct' | 'broader';
  approvedLabels?: string[];
  verification?: 'accepted' | 'no-common-label' | 'unverified';
}
export interface LabelReview { id: string; factor: Factor; values: Value[]; candidates: string[]; scope?: 'shared-component' }
export interface SharedConceptRequest { id: string; factor: Factor; values: Value[] }
export interface SemanticDecision { source: string; target: string; factorId: string; concept: string | null; candidates?: string[] }
export interface Provider {
  metadata: { mode: string; generationModel: string; embeddingModel: string };
  extract(idea: Idea, config: Config): Promise<unknown>;
  embed(texts: string[]): Promise<number[][]>;
  suggestLabels(values: Value[], factor: Factor, config: Config): Promise<unknown>;
  reviewLabels?(requests: LabelReview[]): Promise<unknown>;
  findSharedConcepts?(requests: SharedConceptRequest[]): Promise<unknown>;
}
export interface Analysis {
  configVersion: string; provider: Provider['metadata']; values: EmbeddedValue[];
  decompositions?: { ideaId: string; factors: Record<string, string | null> }[];
  comparisons: Pair[]; pairs: Pair[]; labels: LabelResult[];
  settings?: Config;
  dismissed?: [string, string][];
  broaderPairs?: BroaderPair[];
  broaderComparisons?: Pair[];
  semanticDecisions?: SemanticDecision[];
}
