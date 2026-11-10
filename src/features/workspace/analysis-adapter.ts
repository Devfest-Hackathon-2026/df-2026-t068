import type { IdeaInput, MapAnalysis } from "@/lib/analysis-data";
import type { WorkspaceSnapshot } from "@/features/workspace/types";

const ideaColors = ["#7f8fd4", "#6aa99a", "#b38a67", "#9a75b3", "#b36f86"];

export function analysisToWorkspaceSnapshot(
  analysis: MapAnalysis,
  ideas: IdeaInput[],
): WorkspaceSnapshot {
  const factors = new Map(analysis.factors.map((factor) => [factor.id, factor]));
  const values = new Map(analysis.values.map((value) => [value.id, value]));

  const workspaceIdeas = ideas.map((idea, index) => ({
    id: idea.id,
    title: `アイデア ${index + 1}`,
    originalText: idea.text,
    color: ideaColors[index % ideaColors.length],
  }));

  const concepts: WorkspaceSnapshot["concepts"] = [];
  const relations: WorkspaceSnapshot["relations"] = [];

  for (const idea of workspaceIdeas) {
    concepts.push({
      id: `idea:${idea.id}`,
      kind: "idea",
      ideaId: idea.id,
      label: idea.title,
      description: idea.originalText,
      evidence: idea.originalText,
      inferred: false,
    });

    for (const factor of analysis.factors) {
      const perspectiveId = `perspective:${idea.id}:${factor.id}`;
      const value = analysis.values.find((item) => item.ideaId === idea.id && item.factorId === factor.id);
      if (!value) continue;

      concepts.push({
        id: perspectiveId,
        kind: "perspective",
        ideaId: idea.id,
        parentId: `idea:${idea.id}`,
        label: factor.name,
        perspective: factor.name,
        description: `${idea.title}を「${factor.name}」の観点で分解したものです。`,
        evidence: idea.originalText,
        inferred: false,
      });
      concepts.push({
        id: value.id,
        kind: "factor",
        ideaId: idea.id,
        parentId: perspectiveId,
        label: value.label,
        perspective: factor.name,
        description: value.broaderConcept ? `上位概念：${value.broaderConcept}` : "",
        evidence: idea.originalText,
        inferred: value.inferred,
      });
      relations.push(
        { id: `hierarchy:${idea.id}:${factor.id}`, source: `idea:${idea.id}`, target: perspectiveId, kind: "hierarchy" },
        { id: `hierarchy:${perspectiveId}:${value.id}`, source: perspectiveId, target: value.id, kind: "hierarchy" },
      );
    }
  }

  for (const pair of analysis.pairs) {
    const factor = factors.get(pair.factorId);
    const source = values.get(pair.source);
    const target = values.get(pair.target);
    if (!source || !target) continue;
    relations.push({
      id: `semantic:direct:${pair.factorId}:${pair.source}:${pair.target}`,
      source: pair.source,
      target: pair.target,
      kind: "semantic",
      strength: pair.score,
      reason: `「${factor?.name ?? "同じ観点"}」の分析で、関連度 ${pair.score.toFixed(2)} の接点として記録されています。`,
    });
  }

  for (const pair of analysis.broaderPairs ?? []) {
    if (!values.has(pair.source) || !values.has(pair.target)) continue;
    relations.push({
      id: `semantic:broader:${pair.factorId}:${pair.source}:${pair.target}`,
      source: pair.source,
      target: pair.target,
      kind: "semantic",
      strength: pair.score,
      reason: `上位概念「${pair.sharedConcept}」を介した関連候補です（関連度 ${pair.score.toFixed(2)}）。`,
    });
  }

  return { source: "analysis", ideas: workspaceIdeas, concepts, relations };
}
