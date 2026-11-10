export type IdeaInput = { id: string; text: string };
export type FactorInfo = { id: string; name: string };
export type MapValue = { id: string; ideaId: string; factorId: string; label: string; inferred: boolean; broaderConcept?: string | null };
export type MapPair = { source: string; target: string; factorId: string; score: number };
export type MapLabel = { id: string; label: string; factorId: string; memberIds: string[]; level?: "direct" | "broader" };
export type MapAnalysis = {
  factors: FactorInfo[]; values: MapValue[]; pairs: MapPair[]; labels: MapLabel[];
  configVersion: string;
  comparisons?: MapPair[];
  thresholds?: Record<string, number>;
  broaderPairs?: MapBroaderPair[];
  broaderComparisons?: MapPair[];
  broaderThresholds?: Record<string, number>;
};
export type MapBroaderPair = MapPair & { kind: "broader-concept"; sourceConcept: string; targetConcept: string; sharedConcept: string; method?: "semantic" };
export type MapPositions = Record<string, { x: number; y: number }>;
export function validateIdeas(input: unknown): IdeaInput[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 5) throw new Error("アイデアは2〜5件で入力してください。");
  const result = input.map(value => {
    if (!value || typeof value.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value.id) || typeof value.text !== "string" || !value.text.trim() || value.text.length > 6000) throw new Error("各アイデアを1〜6000文字で入力してください。");
    return { id: value.id, text: value.text.trim() };
  });
  if (new Set(result.map(v => v.id)).size !== result.length) throw new Error("アイデアのIDが重複しています。");
  return result;
}
export function compactAnalysis(
  result: { configVersion: string; values: MapValue[]; pairs: MapPair[]; labels: MapLabel[]; comparisons?: MapPair[]; broaderPairs?: MapBroaderPair[]; broaderComparisons?: MapPair[]; settings?: { similarityThreshold?: number; factorThresholds?: Record<string, number>; abstractionThreshold?: number; abstractionFactorThresholds?: Record<string, number> } },
  factors: FactorInfo[],
): MapAnalysis {
  return normalizeAnalysis({
    configVersion: result.configVersion,
    factors: factors.map(({ id, name }) => ({ id, name })),
    values: result.values.map(({ id, ideaId, factorId, label, inferred, broaderConcept }) => ({ id, ideaId, factorId, label, inferred, broaderConcept: broaderConcept ?? null })),
    pairs: result.pairs.map(({ source, target, factorId, score }) => ({ source, target, factorId, score })),
    labels: result.labels.map(({ id, label, factorId, memberIds, level }) => ({ id, label, factorId, memberIds, level: level ?? "direct" })),
    comparisons: (result.comparisons ?? []).map(({ source, target, factorId, score }) => ({ source, target, factorId, score })),
    thresholds: Object.fromEntries(factors.map(factor => [factor.id, result.settings?.factorThresholds?.[factor.id] ?? result.settings?.similarityThreshold ?? 0.82])),
    broaderPairs: (result.broaderPairs ?? []).map(({source, target, factorId, score, kind, sourceConcept, targetConcept, sharedConcept, method}) => ({source, target, factorId, score, kind, sourceConcept, targetConcept, sharedConcept, ...(method ? {method} : {})})),
    broaderComparisons: (result.broaderComparisons ?? []).map(({source, target, factorId, score}) => ({source, target, factorId, score})),
    broaderThresholds: Object.fromEntries(factors.map(factor => [factor.id, result.settings?.abstractionFactorThresholds?.[factor.id] ?? result.settings?.abstractionThreshold ?? 0.86])),
  });
}
export function normalizeAnalysis(analysis: MapAnalysis): MapAnalysis {
  // Old dictionary-generated links are intentionally not recomputed or promoted.
  return { ...analysis, broaderPairs: analysis.broaderPairs ?? [], broaderComparisons: analysis.broaderComparisons ?? [] };
}
