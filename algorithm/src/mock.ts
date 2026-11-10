import type { Config, Factor, Idea, Provider, Value } from './types.ts';
// Explicit fixture only. This is NOT a general Japanese semantic embedding model.
export class MockProvider implements Provider {
  metadata = { mode: 'mock-fixture-not-semantic', generationModel: 'fixture', embeddingModel: 'fixture-3d' };
  async extract(idea: Idea, c: Config): Promise<unknown> {
    const label = idea.text.includes('個別') ? '個別最適化' : 'パーソナライズ';
    const factorId = c.factors.find(f => f.id === 'mechanism')?.id ?? c.factors[0].id;
    return { factors: Object.fromEntries(c.factors.map(f => [f.id, f.id === factorId ? label : null])), abstractions: Object.fromEntries(c.factors.map(f => [f.id, null])), details: { [factorId]: { description: '一人ひとりに合わせた支援', evidence: '', inferred: true } } };
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(t => t === '個別最適化' ? [1, 0.12, 0] : t === 'パーソナライズ' ? [1, -0.12, 0] : t === '個人適応' ? [1, 0, 0] : [0, 0, 1]);
  }
  async suggestLabels(_values: Value[], _factor: Factor, _c: Config): Promise<unknown> { return { labels: ['個人適応'] }; }
}
