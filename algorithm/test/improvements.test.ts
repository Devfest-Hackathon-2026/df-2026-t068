import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze, analyzeValues } from '../src/core.ts';
import { replay } from '../src/replay.ts';
import { rankLabels, canonicalLabel } from '../src/ranking.ts';
import { MockProvider } from '../src/mock.ts';
import type { Config } from '../src/types.ts';
const config: Config = JSON.parse(await readFile(new URL('../config/default.json', import.meta.url), 'utf8'));
const ideas = [{ id: 'a', text: '個別最適化' }, { id: 'b', text: 'パーソナライズ' }];

test('balanced label beats a midpoint-near label biased to one member', () => {
  const members = [[Math.sqrt(3) / 2, 0.5, 0], [Math.sqrt(3) / 2, -0.5, 0]];
  const ranked = rankLabels(['biased', 'balanced'], [[Math.cos(Math.PI / 12), Math.sin(Math.PI / 12), 0], [0.95, 0, Math.sqrt(1 - 0.95 ** 2)]], members, [1, 0, 0], 0.5, 0.5);
  assert.equal(ranked[0].label, 'balanced');
  assert.ok(ranked[0].score < ranked[1].score);
  assert.ok(ranked[0].memberScore > ranked[1].memberScore);
});
test('label failing either member threshold is marked ineligible', () => {
  assert.equal(rankLabels(['bad'], [[0, 1]], [[1, 0], [1, 0]], [1, 0], 0.5, 0.5)[0].eligible, false);
});
test('identical labels skip LLM candidate generation', async () => {
  const provider = new MockProvider();
  provider.suggestLabels = async () => { throw new Error('Must not call LLM'); };
  const r = await analyze([ideas[0], { id: 'b', text: '個別最適化' }], config, provider);
  assert.equal(r.labels[0].label, '個別最適化');
  assert.equal(canonicalLabel(' ＡＢＣ　支援 '), 'ABC 支援');
});
test('factor-specific thresholds override global threshold', async () => {
  const provider = new MockProvider();
  const r = await analyze(ideas, { ...config, factorThresholds: { mechanism: 1 } }, provider);
  assert.equal(r.comparisons.length, 1);
  assert.equal(r.pairs.length, 0);
  await assert.rejects(analyze(ideas, { ...config, factorThresholds: { typo: 0.3 } }, provider));
});
test('replay reproduces saved calculations without network and preserves exclusions', async () => {
  const saved = await analyze(ideas, config, new MockProvider());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network forbidden'); };
  try {
    const result = await replay(saved, config);
    assert.deepEqual(result.pairs, saved.pairs);
    assert.equal(result.labels[0].label, saved.labels[0].label);
    const excluded = await analyzeValues(saved.values, config, new MockProvider(), undefined, [[saved.values[0].id, saved.values[1].id]]);
    assert.equal((await replay(excluded, config)).pairs.length, 0);
    assert.equal((await replay(saved, { ...config, similarityThreshold: 1 })).pairs.length, 0);
    await assert.rejects(replay(saved, { ...config, embeddingMode: 'context' }));
    await assert.rejects(replay(saved, { ...config, factors: config.factors.slice(1) }));
  } finally { globalThis.fetch = originalFetch; }
});
test('old output without candidate vectors replays with original terms only', async () => {
  const saved = await analyze(ideas, config, new MockProvider());
  for (const l of saved.labels) for (const c of l.candidates) delete c.vector;
  const r = await replay(saved, config);
  assert.ok(['個別最適化', 'パーソナライズ'].includes(r.labels[0].label));
});
