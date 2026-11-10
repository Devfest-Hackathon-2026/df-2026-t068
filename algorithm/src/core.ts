import { createHash } from 'node:crypto';
import { cosine, meanVector, validateVector } from './math.ts';
import { canonicalLabel, rankLabels } from './ranking.ts';
import type { Analysis, Config, EmbeddedValue, ExtractedValue, Idea, LabelResult, Pair, Provider, Value, SemanticDecision } from './types.ts';

export type Similarity = (a: number[], b: number[]) => number;
const id = (...parts: string[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 20);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validateConfig(c: Config): void {
  if (!c.version || !Array.isArray(c.factors) || !c.factors.length) throw new Error('Missing factor definitions');
  if (new Set(c.factors.map(f => f.id)).size !== c.factors.length || c.factors.some(f => !f.id || !f.name || !f.description)) throw new Error('Invalid factor definitions');
  for (const n of [c.maxIdeas, c.maxTextLength, c.maxValuesPerIdea, c.maxLabelLength, c.maxCandidates, c.maxLabels]) {
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Invalid limit');
  }
  for (const n of [c.similarityThreshold, c.minimumLabelSimilarity]) if (!Number.isFinite(n) || n < -1 || n > 1) throw new Error('Invalid threshold');
  if (!['label', 'context', 'meaning'].includes(c.embeddingMode)) throw new Error('Invalid embedding mode');
  if (c.preferredLabelLength !== undefined && (!Number.isSafeInteger(c.preferredLabelLength) || c.preferredLabelLength < 1 || c.preferredLabelLength > c.maxLabelLength)) throw new Error('Invalid preferred label length');
  if (c.abstractionThreshold !== undefined && (!Number.isFinite(c.abstractionThreshold) || c.abstractionThreshold < -1 || c.abstractionThreshold > 1)) throw new Error('Invalid abstraction threshold');
  if (c.semanticCandidateThreshold !== undefined && (!Number.isFinite(c.semanticCandidateThreshold) || c.semanticCandidateThreshold < -1 || c.semanticCandidateThreshold > 1)) throw new Error('Invalid semantic candidate threshold');
  if (c.maxSemanticPairs !== undefined && (!Number.isSafeInteger(c.maxSemanticPairs) || c.maxSemanticPairs < 0 || c.maxSemanticPairs > 60)) throw new Error('Invalid semantic pair limit');
  for (const [factorId, threshold] of Object.entries(c.abstractionFactorThresholds ?? {})) {
    if (!c.factors.some(f => f.id === factorId) || !Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new Error('Invalid abstraction factor threshold');
  }
  for (const [factorId, threshold] of Object.entries(c.factorThresholds ?? {})) {
    if (!c.factors.some(f => f.id === factorId) || !Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new Error('Invalid factor threshold');
  }
  if (c.minimumLabelMemberSimilarity !== undefined && (!Number.isFinite(c.minimumLabelMemberSimilarity) || c.minimumLabelMemberSimilarity < -1 || c.minimumLabelMemberSimilarity > 1)) throw new Error('Invalid member threshold');
}

export function validateExtraction(raw: unknown, idea: Idea, c: Config): Value[] {
  if (!record(raw) || !record(raw.factors) || !record(raw.abstractions) || !record(raw.details)) throw new Error('Invalid extraction result');
  const keys = Object.keys(raw.factors);
  if (keys.length !== c.factors.length || keys.some(k => !c.factors.some(f => f.id === k))) throw new Error('Missing or unknown factor');
  if (Object.keys(raw.abstractions).length !== c.factors.length || Object.keys(raw.abstractions).some(k => !c.factors.some(f => f.id === k))) throw new Error('Missing or unknown abstraction');
  const rows: unknown[] = [];
  for (const factor of c.factors) {
    const label = raw.factors[factor.id];
    const broader = raw.abstractions[factor.id];
    if (broader !== null && (typeof broader !== 'string' || !broader.trim() || broader.length > c.maxLabelLength || /[\r\n]/.test(broader))) throw new Error('Invalid abstraction');
    if (label === null) { if (broader !== null) throw new Error('Null factor cannot have an abstraction'); continue; }
    if (typeof label !== 'string') throw new Error('Each factor must contain one string or null');
    const detail = raw.details[factor.id];
    if (!record(detail)) throw new Error('Missing factor details');
    rows.push({ ...detail, factorId: factor.id, label, broaderConcept: broader });
  }
  if (rows.length > c.maxValuesPerIdea) throw new Error('Too many factor values');
  const seen = new Set<string>();
  return rows.map((v: unknown) => {
    if (!record(v) || typeof v.factorId !== 'string' || !c.factors.some(f => f.id === v.factorId)) throw new Error('Unknown factor');
    if (typeof v.label !== 'string' || !v.label.trim() || v.label.length > c.maxLabelLength || /[\r\n]/.test(v.label)) throw new Error('Invalid short label');
    if (typeof v.description !== 'string' || v.description.length > 1000 || typeof v.evidence !== 'string' || typeof v.inferred !== 'boolean') throw new Error('Invalid value details');
    if (!v.inferred && (!v.evidence || !idea.text.includes(v.evidence))) throw new Error('Evidence must be an exact source excerpt');
    if (v.evidence && !idea.text.includes(v.evidence)) throw new Error('Invented evidence');
    const key = v.factorId;
    if (seen.has(key)) throw new Error('Duplicate factor value');
    seen.add(key);
    const value = v as unknown as ExtractedValue;
    const generic = new Set(['人', '人々', '個人', '利用者', 'ユーザー', 'もの', '物', 'こと', '活動', '問題', '課題', '改善', '支援', 'サービス']);
    const broader = value.broaderConcept ? canonicalLabel(value.broaderConcept) : null;
    return { ...value, broaderConcept: broader && broader !== canonicalLabel(value.label) && !generic.has(broader) ? broader : null, label: canonicalLabel(value.label), id: id(idea.id, key), ideaId: idea.id };
  });
}

export function compareValues(values: EmbeddedValue[], c: Config, similarity: Similarity = cosine): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    const a = values[i], b = values[j];
    if (a.ideaId === b.ideaId || a.factorId !== b.factorId) continue;
    const score = similarity(a.vector, b.vector);
    if (!Number.isFinite(score) || score < -1 || score > 1) throw new Error('Similarity must return a finite score in [-1, 1]');
    if (score >= (c.factorThresholds?.[a.factorId] ?? c.similarityThreshold)) pairs.push({ source: a.id, target: b.id, factorId: a.factorId, score });
  }
  return pairs.sort((a, b) => b.score - a.score || a.source.localeCompare(b.source));
}

function checkVectors(vectors: number[][], count: number, dimension?: number): void {
  if (!Array.isArray(vectors) || vectors.length !== count) throw new Error('Embedding count mismatch');
  for (const v of vectors) {
    validateVector(v);
    if (v.length !== (dimension ?? vectors[0].length)) throw new Error('Vector dimension mismatch');
  }
}

export async function analyze(ideas: Idea[], c: Config, provider: Provider, similarity: Similarity = cosine): Promise<Analysis> {
  validateConfig(c);
  if (!Array.isArray(ideas) || !ideas.length || ideas.length > c.maxIdeas) throw new Error('Invalid number of ideas');
  if (ideas.some(i => !i || typeof i.id !== 'string' || !i.id.trim() || typeof i.text !== 'string' || !i.text.trim() || i.text.length > c.maxTextLength) || new Set(ideas.map(i => i.id)).size !== ideas.length) throw new Error('Invalid or duplicate idea');
  const extracted: Value[] = [];
  for (const idea of ideas) extracted.push(...validateExtraction(await provider.extract(idea, c), idea, c));
  const result = await analyzeValues(extracted, c, provider, similarity);
  return { ...result, decompositions: ideas.map(idea => ({ ideaId: idea.id, factors: Object.fromEntries(c.factors.map(f => [f.id, extracted.find(v => v.ideaId === idea.id && v.factorId === f.id)?.label ?? null])) })) };
}

// Reanalysis consumes edited values without running extraction again; IDs remain unchanged.
export async function analyzeValues(values: Value[], c: Config, provider: Provider, similarity: Similarity = cosine, dismissed: [string, string][] = []): Promise<Analysis> {
  validateConfig(c);
  if (values.length > c.maxIdeas * c.maxValuesPerIdea || new Set(values.map(v => v.id)).size !== values.length) throw new Error('Invalid value count or duplicate ID');
  for (const v of values) {
    if (!v.id || !v.ideaId || !c.factors.some(f => f.id === v.factorId) || !v.label?.trim() || v.label.length > c.maxLabelLength || typeof v.description !== 'string' || typeof v.evidence !== 'string' || typeof v.inferred !== 'boolean') throw new Error('Invalid edited value');
  }
  if (new Set(values.map(v => JSON.stringify([v.ideaId, v.factorId]))).size !== values.length) throw new Error('Each idea must have at most one value per factor');
  for (const v of values) if (v.broaderConcept != null && (typeof v.broaderConcept !== 'string' || !v.broaderConcept.trim() || v.broaderConcept.length > c.maxLabelLength)) throw new Error('Invalid edited abstraction');
  const cache = new Map<string, number[]>();
  let dimension: number | undefined;
  async function embed(texts: string[]): Promise<number[][]> {
    const missing = [...new Set(texts)].filter(t => !cache.has(t));
    if (missing.length) {
      const vectors = await provider.embed(missing);
      checkVectors(vectors, missing.length, dimension);
      dimension ??= vectors[0]?.length;
      missing.forEach((t, i) => cache.set(t, vectors[i]));
    }
    return texts.map(t => cache.get(t)!);
  }
  const texts = values.map(v => embeddingText(v, c));
  const vectors = await embed(texts);
  const broaderIndexes = values.flatMap((v, i) => v.broaderConcept ? [i] : []);
  const broaderVectors = await embed(broaderIndexes.map(i => values[i].broaderConcept!));
  const broaderByIndex = new Map(broaderIndexes.map((index, i) => [index, broaderVectors[i]]));
  const embedded: EmbeddedValue[] = values.map((v, i) => ({ ...v, vector: vectors[i], ...(broaderByIndex.has(i) ? { broaderVector: broaderByIndex.get(i)! } : {}) }));
  const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
  const blocked = new Set(dismissed.map(([a, b]) => pairKey(a, b)));
  const comparisons = compareValues(embedded, { ...c, similarityThreshold: -1, factorThresholds: {} }, similarity);
  const pairs = comparisons.filter(p => p.score >= (c.factorThresholds?.[p.factorId] ?? c.similarityThreshold) && !blocked.has(pairKey(p.source, p.target)));
  const byId = new Map(embedded.map(v => [v.id, v]));
  const labels: LabelResult[] = [];
  const upperValues = embedded.filter(v => v.broaderConcept && v.broaderVector).map(v => ({ ...v, label: v.broaderConcept!, vector: v.broaderVector! }));
  const broaderComparisons = compareValues(upperValues, { ...c, similarityThreshold: -1, factorThresholds: {} }, similarity);
  const upperPairs = broaderComparisons.filter(p => p.score >= (c.abstractionFactorThresholds?.[p.factorId] ?? c.abstractionThreshold ?? 0.86) && !blocked.has(pairKey(p.source, p.target)));
  const upperById = new Map(upperValues.map(v => [v.id, v]));
  const semanticDecisions: SemanticDecision[] = [];
  const recovered = new Map<string, string[]>();
  // A vector threshold retrieves candidates; it is not the final definition of a shared principle.
  if (provider.findSharedConcepts && provider.reviewLabels && (c.maxSemanticPairs ?? 20) > 0) {
    const linked = new Set([...pairs, ...upperPairs].map(pair => pairKey(pair.source, pair.target)));
    const candidates = comparisons.filter(pair => !linked.has(pairKey(pair.source, pair.target)) && !blocked.has(pairKey(pair.source, pair.target)))
      .map(pair => ({ pair, retrieval: Math.max(pair.score, broaderComparisons.find(upper => pairKey(upper.source, upper.target) === pairKey(pair.source, pair.target))?.score ?? -1) }))
      .filter(candidate => candidate.retrieval >= (c.semanticCandidateThreshold ?? 0.6))
      .sort((a,b) => b.retrieval - a.retrieval || pairKey(a.pair.source,a.pair.target).localeCompare(pairKey(b.pair.source,b.pair.target)))
      .slice(0, c.maxSemanticPairs ?? 20).map(candidate => candidate.pair);
    if (candidates.length) {
      const requests = candidates.map(pair => ({ id: pairKey(pair.source, pair.target), factor: c.factors.find(f => f.id === pair.factorId)!, values: [byId.get(pair.source)!, byId.get(pair.target)!] }));
      const raw = await provider.findSharedConcepts(requests);
      if (!record(raw) || !Array.isArray(raw.results) || raw.results.length !== requests.length) throw new Error('Invalid shared concept response');
      const seen = new Set<string>();
      for (const row of raw.results) {
        if (!record(row) || typeof row.id !== 'string' || seen.has(row.id) || typeof row.sourceSupported !== 'boolean' || typeof row.targetSupported !== 'boolean') throw new Error('Invalid shared concept row');
        const pair = candidates.find(pair => pairKey(pair.source,pair.target) === row.id);
        if (!pair || (row.concept !== null && (typeof row.concept !== 'string' || !row.concept.trim() || row.concept.length > c.maxLabelLength || /[\r\n]/.test(row.concept)))) throw new Error('Invalid shared concept');
        seen.add(row.id);
        const generic = new Set(['データ活用','データ分析','情報処理','情報活用','効率化','支援','改善','課題解決','サービス']);
        if (row.alternatives !== undefined && (!Array.isArray(row.alternatives) || row.alternatives.length > 2 || row.alternatives.some(term => typeof term !== 'string' || !term.trim() || term.length > c.maxLabelLength || /[\r\n]/.test(term)))) throw new Error('Invalid alternative concepts');
        const concepts = row.sourceSupported && row.targetSupported && typeof row.concept === 'string' ? [...new Set([row.concept, ...((row.alternatives ?? []) as string[])].map(canonicalLabel))].filter(term => !generic.has(term)) : [];
        const concept = concepts[0] ?? null;
        semanticDecisions.push({ source:pair.source, target:pair.target, factorId:pair.factorId, concept, candidates:concepts });
        if (concept) recovered.set(row.id,concepts);
      }
    }
  }
  const tasks = [
    ...pairs.map(pair => ({ pair, level: 'direct' as const, members: [byId.get(pair.source)!, byId.get(pair.target)!] })),
    ...semanticDecisions.filter(decision => decision.concept).map(decision => ({ pair: comparisons.find(pair => pairKey(pair.source,pair.target) === pairKey(decision.source,decision.target))!, level:'broader' as const, members:[byId.get(decision.source)!,byId.get(decision.target)!] })),
    ...upperPairs.map(pair => ({ pair, level: 'broader' as const, members: [upperById.get(pair.source)!, upperById.get(pair.target)!] })),
  ];
  for (const { pair, level, members } of tasks.slice(0, c.maxLabels)) {
    let centroid: number[];
    try { centroid = meanVector(members.map(v => v.vector)); } catch { continue; }
    const identical = canonicalLabel(members[0].label) === canonicalLabel(members[1].label);
    const recoveredConcept = level === 'broader' ? recovered.get(pairKey(pair.source,pair.target)) : undefined;
    const raw = recoveredConcept ? { labels: recoveredConcept.slice(0,c.maxCandidates) } : identical ? { labels: [] } : await provider.suggestLabels(members, c.factors.find(f => f.id === pair.factorId)!, c);
    if (!record(raw) || !Array.isArray(raw.labels) || raw.labels.length > c.maxCandidates || raw.labels.some(x => typeof x !== 'string' || !x.trim() || x.length > c.maxLabelLength || /[\r\n]/.test(x))) throw new Error('Invalid label candidates');
    const originals = members.map(v => v.label);
    const candidates = [...new Set([...originals, ...(raw.labels as string[])].map(canonicalLabel))];
    const cv = await embed(candidates);
    const ranked = rankLabels(candidates, cv, members.map(v => v.vector), centroid, c.minimumLabelSimilarity, c.minimumLabelMemberSimilarity ?? 0.5);
    const best = ranked[0];
    const fallback = !best.eligible;
    const selected = fallback ? ranked.find(x => originals.map(canonicalLabel).includes(x.label))! : best;
    labels.push({ id: id(level, pair.source, pair.target), level, factorId: pair.factorId, memberIds: members.map(v => v.id), label: selected.label, centroid, score: selected.score, status: fallback ? 'fallback-original' : 'candidate-selected', candidates: recoveredConcept ? ranked.filter(candidate => recoveredConcept.includes(candidate.label)) : ranked, verification: identical && !recoveredConcept ? 'accepted' : 'unverified', ...(identical && !recoveredConcept ? { approvedLabels: [selected.label] } : {}) });
  }
  // Review all non-identical pairs in one generation call, including original-term candidates.
  // Vector proximity alone does not establish that a label contains both meanings.
  const pending = labels.filter(label => label.verification === 'unverified');
  if (pending.length && provider.reviewLabels) {
    const requests = pending.map(label => ({ id: label.id, factor: c.factors.find(f => f.id === label.factorId)!, values: label.memberIds.map(id => (label.level === 'broader' && !recovered.has(pairKey(label.memberIds[0],label.memberIds[1])) ? upperById : byId).get(id)!), candidates: label.candidates.filter(candidate => candidate.eligible).map(candidate => candidate.label), ...(recovered.has(pairKey(label.memberIds[0],label.memberIds[1])) && label.level === 'broader' ? { scope:'shared-component' as const } : {}) }));
    const raw = await provider.reviewLabels(requests);
    if (!record(raw) || !Array.isArray(raw.reviews) || raw.reviews.length !== requests.length) throw new Error('Invalid label review');
    const seen = new Set<string>();
    for (const row of raw.reviews) {
      if (!record(row) || typeof row.id !== 'string' || seen.has(row.id) || !Array.isArray(row.accepted)) throw new Error('Invalid label review row');
      const request = requests.find(request => request.id === row.id);
      if (!request || row.accepted.some(term => typeof term !== 'string' || !request.candidates.includes(term))) throw new Error('Unknown reviewed label');
      seen.add(row.id);
      const label = pending.find(label => label.id === row.id)!;
      label.approvedLabels = [...new Set(row.accepted as string[])];
      const best = label.candidates.find(candidate => label.approvedLabels!.includes(candidate.label));
      label.verification = best ? 'accepted' : 'no-common-label';
      label.label = best?.label ?? (label.level === 'broader' ? '上位概念の関連候補' : '意味の近い値');
      if (best) label.score = best.score;
    }
  }
  const broaderPairs = upperPairs.map(pair => {
    const sourceConcept = upperById.get(pair.source)!.label, targetConcept = upperById.get(pair.target)!.label;
    const label = labels.find(l => l.level === 'broader' && l.memberIds.includes(pair.source) && l.memberIds.includes(pair.target));
    return { ...pair, kind: 'broader-concept' as const, sourceConcept, targetConcept, sharedConcept: label?.label ?? (sourceConcept === targetConcept ? sourceConcept : '上位概念の関連候補') };
  });
  const semanticPairs = semanticDecisions.flatMap(decision => {
    const label = labels.find(label => label.level === 'broader' && label.memberIds.includes(decision.source) && label.memberIds.includes(decision.target) && label.verification === 'accepted');
    if (!decision.concept || !label) return [];
    const comparison = broaderComparisons.find(pair => pairKey(pair.source,pair.target) === pairKey(decision.source,decision.target)) ?? comparisons.find(pair => pairKey(pair.source,pair.target) === pairKey(decision.source,decision.target))!;
    return [{ ...comparison, kind:'broader-concept' as const, method:'semantic' as const, sourceConcept:byId.get(decision.source)!.broaderConcept ?? byId.get(decision.source)!.label, targetConcept:byId.get(decision.target)!.broaderConcept ?? byId.get(decision.target)!.label, sharedConcept:label.label }];
  });
  return { configVersion: c.version, provider: provider.metadata, values: embedded, comparisons, pairs, labels, broaderPairs:[...broaderPairs,...semanticPairs], broaderComparisons, semanticDecisions, settings: structuredClone(c), dismissed: structuredClone(dismissed) };
}

// Keep display labels short; optional meaning mode includes only this factor's explanation.
export function embeddingText(value: Value, config: Config): string {
  if (config.embeddingMode === 'label') return value.label;
  if (config.embeddingMode === 'meaning') return `${value.label}：${value.description || value.label}`;
  return `${value.label}：${value.description}\n原文：${value.evidence}`;
}
