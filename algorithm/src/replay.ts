import { analyzeValues, embeddingText } from './core.ts';
import { canonicalLabel } from './ranking.ts';
import type { Analysis, Config, Provider } from './types.ts';

// This provider is deliberately local-only. Missing vectors are an error;
// it must NEVER fall back to a live model.
export async function replay(saved: Analysis, config: Config): Promise<Analysis> {
  const savedMode = saved.settings?.embeddingMode ?? 'label';
  if (savedMode !== config.embeddingMode) throw new Error('Embedding mode changed; saved vectors cannot be reused');
  if (saved.settings && JSON.stringify(saved.settings.factors) !== JSON.stringify(config.factors)) throw new Error('Factor definitions changed; re-extraction is required');
  const vectors = new Map<string, number[]>();
  function add(text: string, vector: number[]) {
    const old = vectors.get(text);
    if (old && (old.length !== vector.length || old.some((v, i) => Math.abs(v - vector[i]) > 1e-8))) throw new Error('Conflicting cached vectors');
    vectors.set(text, vector);
  }
  for (const v of saved.values) {
    add(embeddingText(v, { ...config, embeddingMode: savedMode }), v.vector);
    if (v.broaderConcept && v.broaderVector) add(v.broaderConcept, v.broaderVector);
  }
  for (const label of saved.labels) for (const c of label.candidates) if (c.vector) add(c.label, c.vector);
  const provider: Provider = {
    ...(saved.semanticDecisions ? { findSharedConcepts: async (requests: import('./types.ts').SharedConceptRequest[]) => ({ results: requests.map(request => {
      const ids=request.values.map(value=>value.id).sort();
      const past=saved.semanticDecisions!.find(decision=>JSON.stringify([decision.source,decision.target].sort())===JSON.stringify(ids));
      return {id:request.id,concept:past?.concept??null,alternatives:past?.candidates?.filter(term=>term!==past.concept).slice(0,2)??[],sourceSupported:Boolean(past?.concept),targetSupported:Boolean(past?.concept)};
    }) }) } : {}),
    ...(saved.labels.some(label => label.approvedLabels !== undefined) ? { reviewLabels: async (requests: import('./types.ts').LabelReview[]) => ({ reviews: requests.map(request => {
      const past = saved.labels.find(label => label.id === request.id);
      return { id: request.id, accepted: (past?.approvedLabels ?? []).filter(term => request.candidates.includes(term)) };
    }) }) } : {}),
    metadata: { ...saved.provider, mode: 'offline-replay' },
    extract: async () => { throw new Error('Replay does not perform extraction'); },
    embed: async texts => texts.map(text => {
      const v = vectors.get(text);
      if (!v) throw new Error(`No saved vector for: ${text}. No API was called.`);
      return v;
    }),
    suggestLabels: async values => {
      const upper = values.every(v => saved.values.find(item => item.id === v.id)?.broaderConcept === v.label);
      const past = saved.labels.find(l => (l.level ?? 'direct') === (upper ? 'broader' : 'direct') && values.every(v => l.memberIds.includes(v.id)));
      // Old outputs have no candidate vectors; use only cached original terms.
      return { labels: (past?.candidates ?? []).filter(c => vectors.has(canonicalLabel(c.label))).slice(0, config.maxCandidates).map(c => c.label) };
    }
  };
  const result = await analyzeValues(saved.values, config, provider, undefined, saved.dismissed ?? []);
  return { ...result, decompositions: saved.decompositions };
}
