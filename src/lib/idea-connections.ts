import type { MapAnalysis, MapPair } from './analysis-data.ts';
export type FactorConnection = { factorId: string; name: string; sourceValue: string; targetValue: string; label: string; kind: 'direct' | 'broader'; score: number };
export type IdeaConnection = { id: string; source: string; target: string; factors: FactorConnection[] };
// Use actual pair evidence, never infer transitive links. Each factor counts once.
export function ideaConnections(analysis: MapAnalysis): IdeaConnection[] {
  const connections = new Map<string, IdeaConnection>();
  const values = new Map(analysis.values.map(value => [value.id, value]));
  function add(pair: MapPair, kind: 'direct' | 'broader', label: string) {
    const a = values.get(pair.source), b = values.get(pair.target);
    if (!a || !b || a.ideaId === b.ideaId || a.factorId !== pair.factorId || b.factorId !== pair.factorId) return;
    const [source, target] = [a.ideaId, b.ideaId].sort();
    const id = JSON.stringify([source, target]);
    const connection = connections.get(id) ?? { id, source, target, factors: [] };
    if (connection.factors.some(factor => factor.factorId === pair.factorId)) return;
    connection.factors.push({ factorId: pair.factorId, name: analysis.factors.find(factor => factor.id === pair.factorId)?.name ?? pair.factorId, sourceValue: source === a.ideaId ? a.label : b.label, targetValue: source === a.ideaId ? b.label : a.label, label, kind, score: pair.score });
    connections.set(id, connection);
  }
  for (const pair of analysis.pairs) {
    const label = analysis.labels.find(label => (label.level ?? 'direct') === 'direct' && label.factorId === pair.factorId && label.memberIds.includes(pair.source) && label.memberIds.includes(pair.target));
    add(pair, 'direct', label?.label ?? '意味の近い値');
  }
  for (const pair of analysis.broaderPairs ?? []) add(pair, 'broader', pair.sharedConcept);
  return [...connections.values()].map(connection => ({ ...connection, factors: connection.factors.sort((a,b) => analysis.factors.findIndex(f => f.id === a.factorId) - analysis.factors.findIndex(f => f.id === b.factorId)) }));
}
