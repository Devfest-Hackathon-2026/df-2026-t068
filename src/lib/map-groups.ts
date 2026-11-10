import type { MapAnalysis } from "./analysis-data.ts";

export type ConnectionGroup = { id: string; factorId: string; kind: "similar" | "broader-concept"; label: string; memberIds: string[] };
const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
export function connectionGroups(analysis: MapAnalysis, factorId: string): ConnectionGroup[] {
  const buckets = new Map<string, { label: string; pairs: { source: string; target: string }[] }>();
  for (const pair of analysis.pairs.filter(pair => pair.factorId === factorId)) {
    const label = analysis.labels.find(label => (label.level ?? "direct") === "direct" && label.memberIds.includes(pair.source) && label.memberIds.includes(pair.target))?.label ?? "意味が近い値";
    const bucket = buckets.get(label) ?? { label, pairs: [] };
    bucket.pairs.push(pair); buckets.set(label, bucket);
  }
  const groups: ConnectionGroup[] = [];
  for (const bucket of buckets.values()) {
    const members = [...new Set(bucket.pairs.flatMap(pair => [pair.source, pair.target]))].sort();
    const links = new Set(bucket.pairs.map(pair => pairKey(pair.source, pair.target)));
    // Max five ideas: merge only complete groups, never infer A~C from A~B~C.
    const cliques: string[][] = [];
    for (let mask = 1; mask < 2 ** members.length; mask++) {
      const subset = members.filter((_, index) => mask & (1 << index));
      if (subset.length > 1 && subset.every((a, i) => subset.slice(i + 1).every(b => links.has(pairKey(a, b))))) cliques.push(subset);
    }
    for (const memberIds of cliques.filter(subset => !cliques.some(other => other.length > subset.length && subset.every(id => other.includes(id))))) groups.push({ id: JSON.stringify(["similar", factorId, bucket.label, memberIds]), factorId, kind: "similar", label: bucket.label, memberIds });
  }
  const upper = new Map<string, {label: string; pairs: {source: string; target: string}[]}>();
  for (const relation of (analysis.broaderPairs ?? []).filter(relation => relation.factorId === factorId)) {
    const bucket = upper.get(relation.sharedConcept) ?? { label: relation.sharedConcept, pairs: [] };
    bucket.pairs.push(relation); upper.set(relation.sharedConcept, bucket);
  }
  for (const bucket of upper.values()) {
    const members = [...new Set(bucket.pairs.flatMap(pair => [pair.source, pair.target]))].sort();
    const links = new Set(bucket.pairs.map(pair => pairKey(pair.source, pair.target)));
    const cliques: string[][] = [];
    for (let mask=1; mask<2**members.length; mask++) {
      const subset=members.filter((_,index)=>mask & (1<<index));
      if (subset.length>1 && subset.every((a,i)=>subset.slice(i+1).every(b=>links.has(pairKey(a,b))))) cliques.push(subset);
    }
    for (const memberIds of cliques.filter(subset=>!cliques.some(other=>other.length>subset.length && subset.every(id=>other.includes(id))))) groups.push({id:JSON.stringify(['broader-concept',factorId,bucket.label,memberIds]),factorId,kind:'broader-concept',label:bucket.label,memberIds});
  }
  return groups;
}
